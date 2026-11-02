import Foundation
import Testing
@testable import LTSuggestions
import LTDomain
import LTTestSupport

@Suite("Relationship rhythm (FR14)")
struct RhythmTests {
    let now = TestDates.fixtureNow // 2026-11-02 09:00 New York
    var context: EvaluationContext { EvaluationContext(now: now, timeZone: TestDates.newYork) }

    /// Jeff chatted on 10 distinct days (twice on some) in the eight weeks ending Oct 10,
    /// observed through a WhatsApp export connected since Aug 1 and refreshed today.
    func makeSnapshot(lastDay: CalendarDay = CalendarDay(2026, 10, 10)) -> (VaultSnapshot, PersonID, ConnectionID) {
        var snapshot = VaultSnapshot()
        let jeff = Person(displayName: "Jeff Park", reminderPreferences: ReminderPreferences(observedPatternEnabled: true), createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[jeff.id] = jeff
        let connection = Connection(
            provider: "whatsapp-chat-export", displayName: "WhatsApp chat export", scopeDescription: "One exported chat",
            coverage: [CoverageInterval(start: TestDates.instant(2026, 8, 1, 0), end: now.addingTimeInterval(-3600), personIDs: [jeff.id])],
            lastSuccessfulRefresh: now.addingTimeInterval(-3600), isManualImport: true, createdAt: TestDates.instant(2026, 8, 1)
        )
        snapshot.connections[connection.id] = connection
        for offset in stride(from: 0, through: 45, by: 5) {
            let day = lastDay.adding(days: -offset)
            for hour in [12, 20] {
                let i = Interaction(personIDs: [jeff.id], kind: .message, occurredAt: day.date(at: TimeOfDay(hour: hour), in: TestDates.newYork), confirmation: .sourceObserved, channel: connection.id.uuidString, createdAt: now)
                snapshot.interactions[i.id] = i
            }
        }
        return (snapshot, jeff.id, connection.id)
    }

    func outcome(_ snapshot: VaultSnapshot, _ person: PersonID, at context: EvaluationContext? = nil) -> RhythmOutcome {
        RhythmAnalyzer.analyze(personID: person, in: snapshot, context: context ?? self.context, parameters: RhythmParameters())
    }

    @Test func regularThenQuietProducesHonestCard() throws {
        let (snapshot, jeff, _) = makeSnapshot()
        guard case .lull(let finding) = outcome(snapshot, jeff) else {
            Issue.record("expected lull, got \(outcome(snapshot, jeff))")
            return
        }
        #expect(finding.activeDaysInBaseline == 10) // multiple messages per day count once
        #expect(finding.quietDays == 23)
        let card = try #require(SuggestionEngine().evaluate(snapshot, context: context).visible.first)
        #expect(card.title == "You and Jeff Park were chatting regularly in the messages you connected. I haven't seen a conversation there in three weeks. Want to check in?")
        #expect(card.explanation.coverage?.contains("WhatsApp chat export") == true)
        #expect(card.explanation.reason.contains("You may have talked elsewhere"))
        #expect(!card.title.lowercased().contains("drift"))
    }

    @Test func tooFewActiveDaysMakesNoClaim() {
        var (snapshot, jeff, _) = makeSnapshot()
        let keep = snapshot.interactions.values.sorted { $0.occurredAt > $1.occurredAt }.prefix(10)
        snapshot.interactions = Dictionary(uniqueKeysWithValues: keep.map { ($0.id, $0) })
        #expect(outcome(snapshot, jeff) != .lull(dummyFinding))
        if case .lull = outcome(snapshot, jeff) { Issue.record("should not claim a pattern") }
    }

    @Test func shortQuietPeriodIsNotALull() {
        let (snapshot, jeff, _) = makeSnapshot(lastDay: CalendarDay(2026, 10, 25))
        #expect(outcome(snapshot, jeff) == .noLull)
    }

    @Test func coverageGapBlocksClaimsAfterReconnect() {
        var (snapshot, jeff, connectionID) = makeSnapshot()
        // Disconnected Sep 1–Oct 30, reconnected Oct 30: the old history is not continuous.
        snapshot.connections[connectionID]?.coverage = [
            CoverageInterval(start: TestDates.instant(2026, 8, 1, 0), end: TestDates.instant(2026, 9, 1, 0), personIDs: [jeff]),
            CoverageInterval(start: TestDates.instant(2026, 10, 30, 0), end: now.addingTimeInterval(-3600), personIDs: [jeff]),
        ]
        guard case .insufficientCoverage = outcome(snapshot, jeff) else {
            Issue.record("expected insufficient coverage")
            return
        }
    }

    @Test func staleOrDisconnectedSourcePausesRule() {
        var (snapshot, jeff, connectionID) = makeSnapshot()
        snapshot.connections[connectionID]?.lastSuccessfulRefresh = now.addingTimeInterval(-5 * 86_400)
        if case .lull = outcome(snapshot, jeff) { Issue.record("stale source must not produce a claim") }
        snapshot.connections[connectionID]?.lastSuccessfulRefresh = now
        snapshot.connections[connectionID]?.state = .disconnected
        if case .lull = outcome(snapshot, jeff) { Issue.record("disconnected source must not produce a claim") }
        snapshot.connections[connectionID]?.state = .needsReconnect
        if case .lull = outcome(snapshot, jeff) { Issue.record("expired source must not produce a claim") }
    }

    @Test func manualCatchUpResetsRule() {
        var (snapshot, jeff, _) = makeSnapshot()
        let call = Interaction(personIDs: [jeff], kind: .call, occurredAt: now.addingTimeInterval(-2 * 86_400), confirmation: .userConfirmed, createdAt: now)
        snapshot.interactions[call.id] = call
        #expect(outcome(snapshot, jeff) == .noLull)
    }

    @Test func groupAndBusinessMessagesDoNotCount() {
        var (snapshot, jeff, _) = makeSnapshot()
        for id in snapshot.interactions.keys { snapshot.interactions[id]?.isGroup = true }
        if case .lull = outcome(snapshot, jeff) { Issue.record("group messages are not one-to-one conversation") }
        for id in snapshot.interactions.keys {
            snapshot.interactions[id]?.isGroup = false
            snapshot.interactions[id]?.isBusiness = true
        }
        if case .lull = outcome(snapshot, jeff) { Issue.record("business messages are not personal conversation") }
    }

    @Test func pauseAndOptOutSuppressEverything() {
        var (snapshot, jeff, _) = makeSnapshot()
        snapshot.people[jeff]?.reminderPreferences.isPaused = true
        #expect(outcome(snapshot, jeff) == .disabled)
        #expect(SuggestionEngine().evaluate(snapshot, context: context).visible.isEmpty)
        snapshot.people[jeff]?.reminderPreferences.isPaused = false
        snapshot.people[jeff]?.reminderPreferences.observedPatternEnabled = false
        #expect(outcome(snapshot, jeff) == .disabled)
    }

    @Test func parametersAreConfigurable() {
        var (snapshot, jeff, _) = makeSnapshot()
        snapshot.preferences.rhythm.lullDays = 30
        #expect(RhythmAnalyzer.analyze(personID: jeff, in: snapshot, context: context, parameters: snapshot.preferences.rhythm) == .noLull)
    }

    var dummyFinding: RhythmFinding {
        RhythmFinding(personID: PersonID(), connectionIDs: [], channelNames: [], coverageStart: now, lastRefresh: now, lastObservedDay: CalendarDay(2026, 1, 1), lastObservedInteraction: InteractionID(), activeDaysInBaseline: 0, quietDays: 0)
    }
}
