import Foundation

public enum ContactNormalizer {
    /// Digits with an optional leading "+". "00" international prefix becomes "+".
    public static func normalizePhone(_ raw: String) -> String {
        let trimmed = raw.trimmed
        var digits = trimmed.filter(\.isNumber)
        var plus = trimmed.hasPrefix("+")
        if !plus, digits.hasPrefix("00") {
            digits.removeFirst(2)
            plus = true
        }
        return plus ? "+" + digits : digits
    }

    public static func normalizeEmail(_ raw: String) -> String {
        raw.trimmed.lowercased()
    }

    /// Two numbers match when their normalized forms are equal, or when both have at least
    /// ten digits and their last ten digits agree (national vs international formatting).
    public static func phonesMatch(_ a: String, _ b: String) -> Bool {
        let na = normalizePhone(a)
        let nb = normalizePhone(b)
        guard !na.isEmpty, !nb.isEmpty else { return false }
        if na == nb { return true }
        let da = na.filter(\.isNumber)
        let db = nb.filter(\.isNumber)
        guard da.count >= 10, db.count >= 10 else { return false }
        return da.suffix(10) == db.suffix(10)
    }

    /// Lowercased, diacritic-insensitive name used for identity hints (never for merging alone).
    public static func normalizeName(_ raw: String) -> String {
        raw.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .joined(separator: " ")
    }
}

public struct DuplicateCandidate: Hashable, Sendable {
    public var first: PersonID
    public var second: PersonID
    public var reasons: [String]
}

/// Detects likely duplicates using normalized phone numbers and email addresses only.
/// Similar names alone are never treated as duplicates; merging always requires review.
public enum DuplicateDetector {
    public static func candidates(in people: [Person]) -> [DuplicateCandidate] {
        let sorted = people.sorted { $0.id < $1.id }
        var result: [DuplicateCandidate] = []
        for i in sorted.indices {
            for j in sorted.indices where j > i {
                let a = sorted[i]
                let b = sorted[j]
                guard a.isDemo == b.isDemo else { continue }
                var reasons: [String] = []
                if a.phoneNumbers.contains(where: { pa in b.phoneNumbers.contains { ContactNormalizer.phonesMatch(pa.value, $0.value) } }) {
                    reasons.append("Same phone number")
                }
                let emailsA = Set(a.emailAddresses.map { ContactNormalizer.normalizeEmail($0.value) })
                if b.emailAddresses.contains(where: { emailsA.contains(ContactNormalizer.normalizeEmail($0.value)) }) {
                    reasons.append("Same email address")
                }
                if !reasons.isEmpty {
                    result.append(DuplicateCandidate(first: a.id, second: b.id, reasons: reasons))
                }
            }
        }
        return result
    }
}

/// A reviewed merge with the changes needed to apply it and to undo it.
public struct MergePlan: Sendable, Hashable {
    public var kept: PersonID
    public var absorbed: PersonID
    public var changes: [RecordChange]
    /// Restores every touched record to its pre-merge state. Valid only until other edits
    /// touch the same records; the app offers it for the current session only.
    public var undoChanges: [RecordChange]
    public var possibleDuplicateDates: [ImportantDateID]
}

public enum MergePlanner {
    public static func planMerge(keep keptID: PersonID, absorb absorbedID: PersonID, in snapshot: VaultSnapshot, now: Date) -> MergePlan? {
        guard keptID != absorbedID, let kept = snapshot.people[keptID], let absorbed = snapshot.people[absorbedID] else {
            return nil
        }
        var changes: [RecordChange] = []
        var undo: [RecordChange] = [.upsert(.person(kept)), .upsert(.person(absorbed))]

        var merged = kept
        merged.preferredName = kept.preferredName ?? absorbed.preferredName
        merged.relationshipLabel = kept.relationshipLabel ?? absorbed.relationshipLabel
        merged.circles = Array(Set(kept.circles + absorbed.circles)).sorted()
        merged.phoneNumbers = kept.phoneNumbers + absorbed.phoneNumbers.filter { candidate in
            !kept.phoneNumbers.contains { ContactNormalizer.phonesMatch($0.value, candidate.value) }
        }
        let keptEmails = Set(kept.emailAddresses.map { ContactNormalizer.normalizeEmail($0.value) })
        merged.emailAddresses = kept.emailAddresses + absorbed.emailAddresses.filter { !keptEmails.contains(ContactNormalizer.normalizeEmail($0.value)) }
        merged.city = kept.city ?? absorbed.city
        merged.timeZoneIdentifier = kept.timeZoneIdentifier ?? absorbed.timeZoneIdentifier
        merged.address = kept.address ?? absorbed.address
        merged.communicationPreferences = kept.communicationPreferences ?? absorbed.communicationPreferences
        merged.notes = [kept.notes, absorbed.notes].compactMap { $0?.nilIfBlank }.joined(separator: "\n\n").nilIfBlank
        merged.boundaries = [kept.boundaries, absorbed.boundaries].compactMap { $0?.nilIfBlank }.joined(separator: "\n").nilIfBlank
        merged.contactReference = kept.contactReference ?? absorbed.contactReference
        merged.isFavorite = kept.isFavorite || absorbed.isFavorite
        merged.reminderPreferences.isPaused = kept.reminderPreferences.isPaused || absorbed.reminderPreferences.isPaused
        merged.reminderPreferences.cadenceDays = kept.reminderPreferences.cadenceDays ?? absorbed.reminderPreferences.cadenceDays
        merged.reminderPreferences.observedPatternEnabled = kept.reminderPreferences.observedPatternEnabled || absorbed.reminderPreferences.observedPatternEnabled
        merged.updatedAt = now
        changes.append(.upsert(.person(merged)))

        func repoint(_ ids: [PersonID]) -> [PersonID] {
            var seen = Set<PersonID>()
            return ids.map { $0 == absorbedID ? keptID : $0 }.filter { seen.insert($0).inserted }
        }

        for s in snapshot.sources.values where s.personIDs.contains(absorbedID) {
            undo.append(.upsert(.source(s)))
            var u = s; u.personIDs = repoint(s.personIDs); changes.append(.upsert(.source(u)))
        }
        for f in snapshot.facts.values where f.personID == absorbedID {
            undo.append(.upsert(.fact(f)))
            var u = f; u.personID = keptID; changes.append(.upsert(.fact(u)))
        }
        var possibleDuplicateDates: [ImportantDateID] = []
        let keptDates = snapshot.importantDates.values.filter { $0.personID == keptID }
        for d in snapshot.importantDates.values where d.personID == absorbedID {
            undo.append(.upsert(.importantDate(d)))
            var u = d; u.personID = keptID; changes.append(.upsert(.importantDate(u)))
            if keptDates.contains(where: { $0.category == d.category && $0.schedule == d.schedule }) {
                possibleDuplicateDates.append(d.id)
            }
        }
        for i in snapshot.interactions.values where i.personIDs.contains(absorbedID) {
            undo.append(.upsert(.interaction(i)))
            var u = i; u.personIDs = repoint(i.personIDs); changes.append(.upsert(.interaction(u)))
        }
        for p in snapshot.promises.values where p.personIDs.contains(absorbedID) || p.owner == .person(absorbedID) {
            undo.append(.upsert(.promise(p)))
            var u = p
            u.personIDs = repoint(p.personIDs)
            if p.owner == .person(absorbedID) { u.owner = .person(keptID) }
            changes.append(.upsert(.promise(u)))
        }
        for c in snapshot.calendarLinks.values where c.personIDs.contains(absorbedID) {
            undo.append(.upsert(.calendarLink(c)))
            var u = c; u.personIDs = repoint(c.personIDs); changes.append(.upsert(.calendarLink(u)))
        }
        for g in snapshot.gifts.values where g.personID == absorbedID {
            undo.append(.upsert(.gift(g)))
            var u = g; u.personID = keptID; changes.append(.upsert(.gift(u)))
        }
        for s in snapshot.suggestions.values where s.personID == absorbedID {
            undo.append(.upsert(.suggestion(s)))
            var u = s; u.personID = keptID; changes.append(.upsert(.suggestion(u)))
        }
        for d in snapshot.drafts.values where d.personID == absorbedID {
            undo.append(.upsert(.draft(d)))
            var u = d
            u.personID = keptID
            if u.recipient?.personID == absorbedID { u.recipient?.personID = keptID }
            changes.append(.upsert(.draft(u)))
        }
        for c in snapshot.captureRecords.values where c.personIDs.contains(absorbedID) {
            undo.append(.upsert(.captureRecord(c)))
            var u = c; u.personIDs = repoint(c.personIDs); changes.append(.upsert(.captureRecord(u)))
        }
        for e in snapshot.lifeEvents.values where e.personID == absorbedID {
            undo.append(.upsert(.lifeEvent(e)))
            var u = e; u.personID = keptID; changes.append(.upsert(.lifeEvent(u)))
        }
        for c in snapshot.connections.values where c.coverage.contains(where: { $0.personIDs?.contains(absorbedID) ?? false }) {
            undo.append(.upsert(.connection(c)))
            var u = c
            u.coverage = c.coverage.map { interval in
                CoverageInterval(start: interval.start, end: interval.end, personIDs: interval.personIDs.map(repoint))
            }
            changes.append(.upsert(.connection(u)))
        }
        for r in snapshot.automationRules.values where r.recipients.contains(where: { $0.personID == absorbedID }) {
            undo.append(.upsert(.automationRule(r)))
            var u = r
            u.recipients = r.recipients.map { RuleRecipient(personID: $0.personID == absorbedID ? keptID : $0.personID, address: $0.address) }
            u.approval = nil // scope changed
            u.isPaused = true
            changes.append(.upsert(.automationRule(u)))
        }
        for a in snapshot.actionAttempts.values where a.recipientPersonID == absorbedID {
            undo.append(.upsert(.actionAttempt(a)))
            var u = a; u.recipientPersonID = keptID; changes.append(.upsert(.actionAttempt(u)))
        }
        changes.append(.delete(.person(absorbedID)))
        return MergePlan(kept: keptID, absorbed: absorbedID, changes: changes, undoChanges: undo, possibleDuplicateDates: possibleDuplicateDates)
    }
}
