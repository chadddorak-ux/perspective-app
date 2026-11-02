import Foundation

/// What to do with confirmed details that were derived from a source being deleted.
public enum DerivedDetailResolution: Sendable, Hashable {
    /// Remove everything derived from the source (default).
    case deleteDerived
    /// Keep details the user already confirmed as their own notes, without the source excerpt.
    case keepConfirmedAsOwnNotes
}

/// Preview + changes for deleting one source (FR2).
public struct SourceDeletionPlan: Sendable, Hashable {
    public var sourceID: SourceID
    public var removedFacts: [FactID] = []
    public var keptFacts: [FactID] = []
    public var removedDates: [ImportantDateID] = []
    public var keptDates: [ImportantDateID] = []
    public var removedPromises: [PromiseID] = []
    public var keptPromises: [PromiseID] = []
    public var removedInteractions: [InteractionID] = []
    public var removedLifeEvents: [LifeEventID] = []
    public var invalidatedSuggestions: [String] = []
    public var invalidatedDrafts: [DraftID] = []
    public var changes: [RecordChange] = []

    public var summary: String {
        var parts: [String] = []
        let removed = removedFacts.count + removedDates.count + removedPromises.count + removedLifeEvents.count
        if removed > 0 { parts.append("\(removed) detail\(removed == 1 ? "" : "s") from this source will be removed") }
        let kept = keptFacts.count + keptDates.count + keptPromises.count
        if kept > 0 { parts.append("\(kept) confirmed detail\(kept == 1 ? "" : "s") will be kept as your own notes") }
        if !removedInteractions.isEmpty { parts.append("\(removedInteractions.count) observed conversation\(removedInteractions.count == 1 ? "" : "s") will be removed") }
        if !invalidatedSuggestions.isEmpty { parts.append("related suggestions will be withdrawn") }
        if !invalidatedDrafts.isEmpty { parts.append("unsent drafts using it will be discarded") }
        return parts.isEmpty ? "Only the source itself will be removed." : parts.joined(separator: "; ") + "."
    }
}

public enum DeletionPlanner {
    /// Plans deletion of a source and everything that depends on it.
    public static func planSourceDeletion(
        _ sourceID: SourceID,
        in snapshot: VaultSnapshot,
        resolution: DerivedDetailResolution = .deleteDerived,
        now: Date
    ) -> SourceDeletionPlan {
        var plan = SourceDeletionPlan(sourceID: sourceID)
        var invalidatedEvidence: Set<EvidenceRef> = [.source(sourceID)]

        for fact in snapshot.facts.values.sorted(by: { $0.id < $1.id }) where fact.sourceID == sourceID {
            if fact.state == .confirmed && resolution == .keepConfirmedAsOwnNotes {
                var kept = fact
                kept.sourceID = nil
                kept.excerpt = nil
                kept.origin = .userAuthored
                kept.updatedAt = now
                plan.keptFacts.append(fact.id)
                plan.changes.append(.upsert(.fact(kept)))
            } else {
                plan.removedFacts.append(fact.id)
                plan.changes.append(.delete(.fact(fact.id)))
                invalidatedEvidence.insert(.fact(fact.id))
            }
        }
        for date in snapshot.importantDates.values.sorted(by: { $0.id < $1.id }) where date.sourceID == sourceID {
            if date.confirmation == .confirmed && resolution == .keepConfirmedAsOwnNotes {
                var kept = date
                kept.sourceID = nil
                kept.excerpt = nil
                kept.updatedAt = now
                plan.keptDates.append(date.id)
                plan.changes.append(.upsert(.importantDate(kept)))
            } else {
                plan.removedDates.append(date.id)
                plan.changes.append(.delete(.importantDate(date.id)))
                invalidatedEvidence.insert(.importantDate(date.id))
                for gift in snapshot.gifts.values where gift.occasionDateID == date.id {
                    var updated = gift
                    updated.occasionDateID = nil
                    plan.changes.append(.upsert(.gift(updated)))
                }
            }
        }
        for promise in snapshot.promises.values.sorted(by: { $0.id < $1.id }) where promise.sourceID == sourceID {
            if promise.confirmation == .confirmed && resolution == .keepConfirmedAsOwnNotes {
                var kept = promise
                kept.sourceID = nil
                kept.excerpt = nil
                kept.updatedAt = now
                plan.keptPromises.append(promise.id)
                plan.changes.append(.upsert(.promise(kept)))
            } else {
                plan.removedPromises.append(promise.id)
                plan.changes.append(.delete(.promise(promise.id)))
                invalidatedEvidence.insert(.promise(promise.id))
            }
        }
        for interaction in snapshot.interactions.values.sorted(by: { $0.id < $1.id }) where interaction.sourceID == sourceID {
            plan.removedInteractions.append(interaction.id)
            plan.changes.append(.delete(.interaction(interaction.id)))
            invalidatedEvidence.insert(.interaction(interaction.id))
        }
        for event in snapshot.lifeEvents.values.sorted(by: { $0.id < $1.id }) where event.sourceIDs.contains(sourceID) {
            let remaining = event.sourceIDs.filter { $0 != sourceID }
            if remaining.isEmpty {
                plan.removedLifeEvents.append(event.id)
                plan.changes.append(.delete(.lifeEvent(event.id)))
                invalidatedEvidence.insert(.lifeEvent(event.id))
            } else {
                var updated = event
                updated.sourceIDs = remaining
                // The excerpt came from one of the sources; drop it rather than risk retaining deleted text.
                updated.excerpt = ""
                updated.confirmation = updated.confirmation == .confirmed ? .confirmed : .unconfirmed
                plan.changes.append(.upsert(.lifeEvent(updated)))
            }
        }
        for record in snapshot.captureRecords.values.sorted(by: { $0.id < $1.id }) where record.sourceID == sourceID {
            plan.changes.append(.delete(.captureRecord(record.id)))
        }

        appendInvalidations(for: invalidatedEvidence, in: snapshot, now: now, suggestions: &plan.invalidatedSuggestions, drafts: &plan.invalidatedDrafts, changes: &plan.changes)
        plan.changes.append(.delete(.source(sourceID)))
        return plan
    }

    static func appendInvalidations(
        for evidence: Set<EvidenceRef>,
        in snapshot: VaultSnapshot,
        now: Date,
        suggestions: inout [String],
        drafts: inout [DraftID],
        changes: inout [RecordChange]
    ) {
        for record in snapshot.suggestions.values.sorted(by: { $0.occurrenceKey < $1.occurrenceKey })
        where !record.state.isTerminal && record.evidence.contains(where: evidence.contains) {
            var updated = record
            updated.state = .invalidated
            updated.evidence = []
            updated.reason = ""
            updated.updatedAt = now
            suggestions.append(record.occurrenceKey)
            changes.append(.upsert(.suggestion(updated)))
        }
        for draft in snapshot.drafts.values.sorted(by: { $0.id < $1.id })
        where draft.isUnsent && draft.evidence.contains(where: evidence.contains) {
            var updated = draft
            updated.outcome = .invalidated
            updated.text = ""
            updated.evidence = []
            updated.updatedAt = now
            drafts.append(draft.id)
            changes.append(.upsert(.draft(updated)))
        }
    }
}

/// How to handle a source shared between the person being deleted and other people.
public enum SharedSourceResolution: Sendable, Hashable {
    /// Keep the note for the other people; remove only this person's link (default).
    case detach
    /// Delete the shared note entirely.
    case delete
}

/// Preview + changes for deleting a person (FR11).
public struct PersonDeletionPlan: Sendable, Hashable {
    public var personID: PersonID
    public var exclusiveSources: [SourceID] = []
    public var sharedSources: [SourceID] = []
    public var facts = 0
    public var dates = 0
    public var promisesDeleted = 0
    public var promisesDetached = 0
    public var interactionsDeleted = 0
    public var interactionsDetached = 0
    public var gifts = 0
    public var calendarLinks = 0
    public var drafts = 0
    public var lifeEvents = 0
    public var automationRulesChanged = 0
    public var changes: [RecordChange] = []

    public var previewLines: [String] {
        var lines: [String] = []
        func add(_ count: Int, _ noun: String) {
            if count > 0 { lines.append("\(count) \(noun)\(count == 1 ? "" : "s")") }
        }
        add(exclusiveSources.count, "note")
        add(facts, "detail")
        add(dates, "date")
        add(promisesDeleted, "promise")
        add(interactionsDeleted, "logged interaction")
        add(gifts, "gift idea")
        add(calendarLinks, "linked event")
        add(drafts, "draft")
        add(lifeEvents, "life update")
        if !sharedSources.isEmpty { lines.append("\(sharedSources.count) shared note\(sharedSources.count == 1 ? "" : "s") also mention other people") }
        if automationRulesChanged > 0 { lines.append("\(automationRulesChanged) automation rule\(automationRulesChanged == 1 ? "" : "s") will be paused for re-approval") }
        return lines
    }
}

extension DeletionPlanner {
    public static func planPersonDeletion(
        _ personID: PersonID,
        in snapshot: VaultSnapshot,
        sharedSources resolution: SharedSourceResolution = .detach,
        now: Date
    ) -> PersonDeletionPlan {
        var plan = PersonDeletionPlan(personID: personID)
        var working = snapshot
        var changes: [RecordChange] = []
        func record(_ change: RecordChange) {
            changes.append(change)
            working.apply(change)
        }

        // Sources: exclusive ones are deleted with their dependents; shared ones per resolution.
        for source in snapshot.sources.values.sorted(by: { $0.id < $1.id }) where source.personIDs.contains(personID) {
            if source.personIDs.count == 1 || resolution == .delete {
                if source.personIDs.count == 1 { plan.exclusiveSources.append(source.id) } else { plan.sharedSources.append(source.id) }
                let sub = planSourceDeletion(source.id, in: working, resolution: .deleteDerived, now: now)
                sub.changes.forEach(record)
            } else {
                plan.sharedSources.append(source.id)
                var updated = source
                updated.personIDs.removeAll { $0 == personID }
                updated.updatedAt = now
                record(.upsert(.source(updated)))
            }
        }

        var evidence: Set<EvidenceRef> = [.person(personID)]
        for fact in working.facts.values.sorted(by: { $0.id < $1.id }) where fact.personID == personID {
            plan.facts += 1
            evidence.insert(.fact(fact.id))
            record(.delete(.fact(fact.id)))
        }
        for gift in working.gifts.values.sorted(by: { $0.id < $1.id }) where gift.personID == personID {
            plan.gifts += 1
            record(.delete(.gift(gift.id)))
        }
        for date in working.importantDates.values.sorted(by: { $0.id < $1.id }) where date.personID == personID {
            plan.dates += 1
            evidence.insert(.importantDate(date.id))
            record(.delete(.importantDate(date.id)))
        }
        for event in working.lifeEvents.values.sorted(by: { $0.id < $1.id }) where event.personID == personID {
            plan.lifeEvents += 1
            record(.delete(.lifeEvent(event.id)))
        }
        for promise in working.promises.values.sorted(by: { $0.id < $1.id }) where promise.personIDs.contains(personID) {
            if promise.personIDs.count == 1 {
                plan.promisesDeleted += 1
                evidence.insert(.promise(promise.id))
                record(.delete(.promise(promise.id)))
            } else {
                plan.promisesDetached += 1
                var updated = promise
                updated.personIDs.removeAll { $0 == personID }
                if case .person(personID) = updated.owner { updated.owner = .me }
                updated.updatedAt = now
                record(.upsert(.promise(updated)))
            }
        }
        for interaction in working.interactions.values.sorted(by: { $0.id < $1.id }) where interaction.personIDs.contains(personID) {
            if interaction.personIDs.count == 1 {
                plan.interactionsDeleted += 1
                record(.delete(.interaction(interaction.id)))
            } else {
                plan.interactionsDetached += 1
                var updated = interaction
                updated.personIDs.removeAll { $0 == personID }
                record(.upsert(.interaction(updated)))
            }
        }
        for link in working.calendarLinks.values.sorted(by: { $0.id < $1.id }) where link.personIDs.contains(personID) {
            plan.calendarLinks += 1
            if link.personIDs.count == 1 {
                record(.delete(.calendarLink(link.id)))
            } else {
                var updated = link
                updated.personIDs.removeAll { $0 == personID }
                record(.upsert(.calendarLink(updated)))
            }
        }
        for suggestion in working.suggestions.values.sorted(by: { $0.occurrenceKey < $1.occurrenceKey }) where suggestion.personID == personID {
            record(.delete(.suggestion(suggestion.occurrenceKey)))
        }
        for draft in working.drafts.values.sorted(by: { $0.id < $1.id }) where draft.personID == personID {
            plan.drafts += 1
            record(.delete(.draft(draft.id)))
        }
        for capture in working.captureRecords.values.sorted(by: { $0.id < $1.id }) where capture.personIDs.contains(personID) {
            var updated = capture
            updated.personIDs.removeAll { $0 == personID }
            if updated.personIDs.isEmpty && updated.sourceID == nil && updated.interactionID == nil {
                record(.delete(.captureRecord(capture.id)))
            } else {
                record(.upsert(.captureRecord(updated)))
            }
        }
        for connection in working.connections.values.sorted(by: { $0.id < $1.id })
        where connection.coverage.contains(where: { $0.personIDs?.contains(personID) ?? false }) {
            var updated = connection
            updated.coverage = connection.coverage.compactMap { interval in
                guard let ids = interval.personIDs else { return interval }
                let remaining = ids.filter { $0 != personID }
                return remaining.isEmpty ? nil : CoverageInterval(start: interval.start, end: interval.end, personIDs: remaining)
            }
            record(.upsert(.connection(updated)))
        }
        for rule in working.automationRules.values.sorted(by: { $0.id < $1.id }) where rule.recipients.contains(where: { $0.personID == personID }) {
            plan.automationRulesChanged += 1
            var updated = rule
            updated.recipients.removeAll { $0.personID == personID }
            // Scope changed: approval is void; the rule must be re-approved.
            updated.approval = nil
            updated.isPaused = true
            updated.updatedAt = now
            if updated.recipients.isEmpty {
                record(.delete(.automationRule(rule.id)))
            } else {
                record(.upsert(.automationRule(updated)))
            }
        }
        for attempt in working.actionAttempts.values.sorted(by: { $0.id < $1.id }) where attempt.recipientPersonID == personID {
            record(.delete(.actionAttempt(attempt.id)))
        }

        var ignoredSuggestions: [String] = []
        var ignoredDrafts: [DraftID] = []
        var invalidations: [RecordChange] = []
        appendInvalidations(for: evidence, in: working, now: now, suggestions: &ignoredSuggestions, drafts: &ignoredDrafts, changes: &invalidations)
        invalidations.forEach(record)

        record(.delete(.person(personID)))
        plan.changes = changes
        return plan
    }
}
