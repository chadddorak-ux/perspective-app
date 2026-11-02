import Foundation
import LTDomain

public struct SuggestionResult: Sendable {
    /// Cards for Today, respecting the daily limit and per-person cap.
    public var visible: [SuggestionCard]
    /// Other eligible items for the optional "More upcoming" view.
    public var more: [SuggestionCard]
    /// State changes to persist (new records, snooze expiry, invalidations, pruning).
    public var stateChanges: [RecordChange]
}

/// Deterministic FR7 engine. Same snapshot + evaluation context ⇒ same output.
/// No model is involved; every card carries its own explanation.
public struct SuggestionEngine: Sendable {
    public var parameters: RuleParameters
    public var locale: Locale
    /// Records older than this (past their occurrence) are pruned.
    public var recordRetentionDays: Int

    public init(parameters: RuleParameters = RuleParameters(), locale: Locale = Locale(identifier: "en_US"), recordRetentionDays: Int = 120) {
        self.parameters = parameters
        self.locale = locale
        self.recordRetentionDays = recordRetentionDays
    }

    /// All eligible candidates after evidence validation, before state and limits.
    public func candidates(_ snapshot: VaultSnapshot, context: EvaluationContext) -> [SuggestionCard] {
        let rules = RuleSet(snapshot: snapshot, context: context, parameters: parameters, phrasing: DayPhrasing(locale: locale, timeZone: context.timeZone))
        var seen = Set<String>()
        return rules.allCandidates()
            .filter { evidenceIsValid($0.evidence, in: snapshot, now: context.now) }
            .sorted(by: SuggestionCard.ranked)
            .filter { seen.insert($0.occurrenceKey).inserted }
    }

    public func evaluate(_ snapshot: VaultSnapshot, context: EvaluationContext) -> SuggestionResult {
        let preferences = snapshot.preferences
        var changes: [RecordChange] = []
        var eligible: [SuggestionCard] = []

        for card in candidates(snapshot, context: context) {
            if let record = snapshot.suggestions[card.occurrenceKey] {
                if record.state.isTerminal { continue }
                if record.state == .snoozed {
                    if let until = record.snoozedUntil, until > context.now { continue }
                }
            }
            eligible.append(card)
        }

        // Suggestions disabled: only the user's own pinned items remain.
        let pool = preferences.suggestionsEnabled ? eligible : eligible.filter(\.isPinned)
        let limit = max(0, preferences.dailyCardLimit)
        let perPersonCap = max(0, preferences.maxUnsolicitedCardsPerPersonPerDay)

        // Unsolicited cards already shown today count toward the per-person cap.
        var shownToday: [PersonID: Set<String>] = [:]
        for record in snapshot.suggestions.values where !record.isPinned {
            guard let first = record.firstShownAt, CalendarDay(date: first, timeZone: context.timeZone) == context.today else { continue }
            shownToday[record.personID, default: []].insert(record.occurrenceKey)
        }

        var visible: [SuggestionCard] = []
        var more: [SuggestionCard] = []
        for card in pool {
            if card.isPinned {
                visible.append(card)
                continue
            }
            var keys = shownToday[card.personID] ?? []
            let alreadyCounted = keys.contains(card.occurrenceKey)
            let underPersonCap = alreadyCounted || keys.count < perPersonCap
            // Pinned cards rank first and are always shown; they count toward the limit.
            if underPersonCap && visible.count < limit {
                visible.append(card)
                keys.insert(card.occurrenceKey)
                shownToday[card.personID] = keys
            } else {
                more.append(card)
            }
        }
        if !preferences.suggestionsEnabled {
            more = []
        }

        // Persist states: visible cards become visible (and remember first display);
        // eligible-but-hidden cards are recorded as proposed.
        let visibleKeys = Set(visible.map(\.occurrenceKey))
        for card in visible + more {
            let existing = snapshot.suggestions[card.occurrenceKey]
            let targetState: SuggestionState = visibleKeys.contains(card.occurrenceKey) ? .visible : (existing?.state == .visible ? .visible : .proposed)
            var record = existing ?? SuggestionRecord(
                id: SuggestionID(stableUUID("suggestion|" + card.occurrenceKey)),
                occurrenceKey: card.occurrenceKey,
                ruleID: card.ruleID,
                personID: card.personID,
                evidence: card.evidence,
                reason: card.explanation.reason,
                scheduledFor: card.relevantAt,
                state: targetState,
                isPinned: card.isPinned,
                updatedAt: context.now
            )
            var changed = existing == nil
            if record.state != targetState {
                record.state = targetState
                record.snoozedUntil = nil
                changed = true
            }
            if targetState == .visible && record.firstShownAt == nil {
                record.firstShownAt = context.now
                changed = true
            }
            if record.evidence != card.evidence {
                record.evidence = card.evidence
                changed = true
            }
            if changed {
                record.updatedAt = context.now
                changes.append(.upsert(.suggestion(record)))
            }
        }

        // Invalidate active records whose evidence disappeared; prune stale history.
        let retention = Double(recordRetentionDays) * 86_400
        for record in snapshot.suggestions.values.sorted(by: { $0.occurrenceKey < $1.occurrenceKey }) {
            if record.state.isTerminal || record.state == .invalidated {
                if context.now.timeIntervalSince(record.scheduledFor) > retention {
                    changes.append(.delete(.suggestion(record.occurrenceKey)))
                }
                continue
            }
            if !evidenceIsValid(record.evidence, in: snapshot, now: context.now) {
                var updated = record
                updated.state = .invalidated
                updated.evidence = []
                updated.reason = ""
                updated.updatedAt = context.now
                changes.append(.upsert(.suggestion(updated)))
            } else if context.now.timeIntervalSince(record.scheduledFor) > retention {
                changes.append(.delete(.suggestion(record.occurrenceKey)))
            }
        }

        return SuggestionResult(visible: visible, more: more, stateChanges: changes)
    }

    /// Evidence must exist, belong to the present, and not be disputed.
    public func evidenceIsValid(_ evidence: [EvidenceRef], in snapshot: VaultSnapshot, now: Date) -> Bool {
        for ref in evidence {
            switch ref {
            case .source(let id):
                guard let source = snapshot.sources[id], source.capturedAt <= now else { return false }
            case .fact(let id):
                guard let fact = snapshot.facts[id], fact.state != .disputed, fact.createdAt <= now else { return false }
            case .importantDate(let id):
                guard snapshot.importantDates[id] != nil else { return false }
            case .promise(let id):
                guard snapshot.promises[id] != nil else { return false }
            case .interaction(let id):
                guard let interaction = snapshot.interactions[id], interaction.occurredAt <= now else { return false }
            case .calendarLink(let id):
                guard snapshot.calendarLinks[id] != nil else { return false }
            case .lifeEvent(let id):
                guard let event = snapshot.lifeEvents[id], event.capturedAt <= now else { return false }
            case .trip(let id):
                guard snapshot.trips[id] != nil else { return false }
            case .gift(let id):
                guard snapshot.gifts[id] != nil else { return false }
            case .person(let id):
                guard snapshot.people[id] != nil else { return false }
            }
        }
        return true
    }
}

/// Card state transitions requested by the user. Pure; returns the record to persist.
public enum SuggestionTransitions {
    public enum Action: Sendable, Hashable {
        case snooze(until: Date)
        case dismiss
        case complete
    }

    public static func apply(_ action: Action, to card: SuggestionCard, existing: SuggestionRecord?, now: Date) -> SuggestionRecord {
        var record = existing ?? SuggestionRecord(
            id: SuggestionID(stableUUID("suggestion|" + card.occurrenceKey)),
            occurrenceKey: card.occurrenceKey,
            ruleID: card.ruleID,
            personID: card.personID,
            evidence: card.evidence,
            reason: card.explanation.reason,
            scheduledFor: card.relevantAt,
            state: .visible,
            isPinned: card.isPinned,
            firstShownAt: now,
            updatedAt: now
        )
        switch action {
        case .snooze(let until):
            record.state = .snoozed
            record.snoozedUntil = until
        case .dismiss:
            record.state = .dismissed
            record.snoozedUntil = nil
        case .complete:
            record.state = .completed
            record.snoozedUntil = nil
        }
        record.updatedAt = now
        return record
    }

    /// "Remind me tonight": the next evening time outside quiet hours, as an absolute instant.
    public static func tonight(context: EvaluationContext, quietHours: QuietHours, evening: TimeOfDay = .evening) -> Date {
        var day = context.today
        if context.timeOfDay >= evening { day = day.adding(days: 1) }
        let (adjustedDay, time) = quietHours.adjust(day: day, time: evening)
        return adjustedDay.date(at: time, in: context.timeZone)
    }
}

/// Deterministic UUID derived from a string (SHA-free, FNV-based), used so the same card
/// occurrence always maps to the same record ID.
public func stableUUID(_ string: String) -> UUID {
    func fnv(_ seed: UInt64) -> UInt64 {
        var hash = seed
        for byte in string.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return hash
    }
    let a = fnv(0xcbf2_9ce4_8422_2325)
    let b = fnv(0x8422_2325_cbf2_9ce4)
    var bytes = [UInt8](repeating: 0, count: 16)
    for i in 0..<8 {
        bytes[i] = UInt8(truncatingIfNeeded: a >> (UInt64(i) * 8))
        bytes[i + 8] = UInt8(truncatingIfNeeded: b >> (UInt64(i) * 8))
    }
    bytes[6] = (bytes[6] & 0x0F) | 0x40
    bytes[8] = (bytes[8] & 0x3F) | 0x80
    return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                       bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
}
