import Foundation
import LTDomain

/// An observed lull in a previously regular conversation, within connected sources only.
/// This is not a statement about the relationship and never claims complete knowledge.
public struct RhythmFinding: Hashable, Sendable {
    public var personID: PersonID
    public var connectionIDs: [ConnectionID]
    public var channelNames: [String]
    public var coverageStart: Date
    public var lastRefresh: Date
    public var lastObservedDay: CalendarDay
    public var lastObservedInteraction: InteractionID
    public var activeDaysInBaseline: Int
    public var quietDays: Int
}

public enum RhythmOutcome: Hashable, Sendable {
    case disabled
    /// Not enough connected, continuous, fresh history to say anything.
    case insufficientCoverage(String)
    case noLull
    case lull(RhythmFinding)
}

/// FR14 rule. Parameters are configurable product hypotheses, not relationship metrics.
///
/// For each active connection covering the person:
/// 1. Only source-observed, one-to-one, non-business interactions from that connection count.
/// 2. Multiple messages on one local day count as one active day.
/// 3. Baseline = the `baselineWeeks * 7` days ending on the last observed day; it needs at
///    least `minimumActiveDays` active days.
/// 4. The quiet period from the last observed day to today must be at least `lullDays`.
/// 5. The connection must have continuous coverage from the baseline start through its last
///    refresh, and that refresh must be fresh. Reconnecting leaves a gap, so no stale alert
///    can fire before a fresh history exists.
/// 6. Any later interaction for the person (any channel, or a manually confirmed catch-up)
///    resets the rule.
public enum RhythmAnalyzer {
    public static func analyze(
        personID: PersonID,
        in snapshot: VaultSnapshot,
        context: EvaluationContext,
        parameters: RhythmParameters
    ) -> RhythmOutcome {
        guard let person = snapshot.people[personID], person.isEligibleForSuggestions,
              person.reminderPreferences.observedPatternEnabled else {
            return .disabled
        }
        let today = context.today
        let allForPerson = snapshot.interactions.values.filter { $0.personIDs.contains(personID) && $0.occurredAt <= context.now }
        let connections = snapshot.connections.values
            .filter { $0.state.isActive && $0.coverage.contains { $0.covers(personID: personID) } }
            .sorted { $0.id < $1.id }
        guard !connections.isEmpty else { return .insufficientCoverage("No connected source covers this person.") }

        var findings: [RhythmFinding] = []
        var reasons: [String] = []
        for connection in connections {
            guard let lastRefresh = connection.lastSuccessfulRefresh,
                  context.now.timeIntervalSince(lastRefresh) <= Double(parameters.maximumStalenessHours) * 3600 else {
                reasons.append("\(connection.displayName) has not refreshed recently.")
                continue
            }
            let observed = allForPerson.filter {
                $0.confirmation == .sourceObserved && $0.channel == connection.id.uuidString &&
                    !$0.isGroup && !$0.isBusiness && $0.personIDs.count == 1
            }
            guard let last = observed.max(by: { $0.occurredAt < $1.occurredAt }) else {
                reasons.append("No one-to-one conversations observed in \(connection.displayName).")
                continue
            }
            let lastDay = CalendarDay(date: last.occurredAt, timeZone: context.timeZone)
            let quietDays = lastDay.days(until: today)
            let baselineStartDay = lastDay.adding(days: -(parameters.baselineWeeks * 7) + 1)
            let activeDays = Set(observed.map { CalendarDay(date: $0.occurredAt, timeZone: context.timeZone) }
                .filter { $0 >= baselineStartDay && $0 <= lastDay })
            guard activeDays.count >= parameters.minimumActiveDays else {
                reasons.append("Not enough regular history in \(connection.displayName).")
                continue
            }
            let baselineStart = baselineStartDay.startOfDay(in: context.timeZone)
            guard covers(connection: connection, personID: personID, from: baselineStart, through: lastRefresh) else {
                reasons.append("\(connection.displayName) was not connected continuously.")
                continue
            }
            // Any later contact anywhere resets the rule.
            let later = allForPerson.contains { $0.occurredAt > last.occurredAt && !$0.isBusiness }
            if later || quietDays < parameters.lullDays {
                continue
            }
            findings.append(RhythmFinding(
                personID: personID,
                connectionIDs: [connection.id],
                channelNames: [connection.displayName],
                coverageStart: baselineStart,
                lastRefresh: lastRefresh,
                lastObservedDay: lastDay,
                lastObservedInteraction: last.id,
                activeDaysInBaseline: activeDays.count,
                quietDays: quietDays
            ))
        }
        if let best = findings.sorted(by: { ($0.lastObservedDay, $0.connectionIDs[0]) > ($1.lastObservedDay, $1.connectionIDs[0]) }).first {
            return .lull(best)
        }
        if reasons.count == connections.count {
            return .insufficientCoverage(reasons.joined(separator: " "))
        }
        return .noLull
    }

    /// Whether the union of the connection's coverage intervals for this person contains
    /// [start, end] without gaps.
    static func covers(connection: Connection, personID: PersonID, from start: Date, through end: Date) -> Bool {
        let intervals = connection.coverage.filter { $0.covers(personID: personID) }.sorted { $0.start < $1.start }
        var reached = start
        for interval in intervals {
            if interval.start > reached { break }
            reached = max(reached, interval.end)
            if reached >= end { return true }
        }
        return reached >= end
    }
}
