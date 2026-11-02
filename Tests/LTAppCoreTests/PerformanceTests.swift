import Foundation
import Testing
@testable import LTAppCore
import LTDomain
import LTSuggestions
import LTTestSupport
import LTVault

/// Opt-in benchmark for PRD §11 targets (1,000 people, 20,000 notes). Run with
/// `LT_PERF=1 swift test --filter PerformanceTests`. Numbers depend on the machine; the PRD
/// targets apply to the declared reference iPhone, which has not been measured.
@Suite("Performance (opt-in)", .enabled(if: ProcessInfo.processInfo.environment["LT_PERF"] == "1"))
struct PerformanceTests {
    @Test func thousandPeopleTwentyThousandNotes() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("perf.ltdb")
        let key = VaultKeyMaterial.generate()
        let now = TestDates.fixtureNow
        var changes: [RecordChange] = []
        var people: [PersonID] = []
        let words = ["climbing", "jazz", "recital", "garden", "marathon", "cello", "pottery", "sailing", "chess", "baking"]
        for i in 0..<1_000 {
            let p = Person(displayName: "Person \(i)", city: i % 7 == 0 ? "Chicago" : "Seattle", reminderPreferences: ReminderPreferences(cadenceDays: i % 5 == 0 ? 30 : nil), createdAt: now)
            people.append(p.id)
            changes.append(.upsert(.person(p)))
            changes.append(.upsert(.importantDate(ImportantDate(personID: p.id, category: .birthday, schedule: .annual(AnnualDate(month: i % 12 + 1, day: i % 28 + 1)!), createdAt: now))))
        }
        for n in 0..<20_000 {
            let person = people[n % people.count]
            let text = "Note \(n): talked about \(words[n % words.count]) and plans for the weekend. They mentioned \(words[(n / 3) % words.count]) again."
            changes.append(.upsert(.source(Source(kind: .manualNote, capturedAt: now.addingTimeInterval(-Double(n) * 600), text: text, personIDs: [person]))))
        }
        let store = try VaultStore(databaseURL: url, key: key)
        let writeStart = Date()
        try await store.apply(changes)
        let writeSeconds = Date().timeIntervalSince(writeStart)
        await store.close()

        // Cold open + load (first meaningful screen depends on this plus one engine pass).
        let openStart = Date()
        let reopened = try VaultStore(databaseURL: url, key: key)
        let snapshot = try await reopened.loadSnapshot()
        let loadSeconds = Date().timeIntervalSince(openStart)

        let engineStart = Date()
        let result = SuggestionEngine().evaluate(snapshot, context: EvaluationContext(now: now, timeZone: TestDates.newYork))
        let engineSeconds = Date().timeIntervalSince(engineStart)

        let warmStart = Date()
        let corpus = LocalSearch.Corpus(snapshot) // built once after each change ("warm-up")
        let corpusSeconds = Date().timeIntervalSince(warmStart)
        var searchTimes: [Double] = []
        for query in ["jazz", "person 42", "weekend plans", "marathon cello", "nothing-matches"] + words {
            for _ in 0..<5 {
                let start = Date()
                _ = corpus.search(query)
                searchTimes.append(Date().timeIntervalSince(start))
            }
        }
        searchTimes.sort()
        let p95 = searchTimes[Int(Double(searchTimes.count - 1) * 0.95)]
        let size = (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0

        print(String(format: "PERF records=%d write=%.2fs open+load=%.3fs engine=%.3fs (visible=%d) corpus=%.3fs search_p95=%.1fms db=%.1fMB",
                     snapshot.recordCount, writeSeconds, loadSeconds, engineSeconds, result.visible.count, corpusSeconds, p95 * 1000, Double(size) / 1_048_576))
        #expect(snapshot.people.count == 1_000)
        #expect(snapshot.sources.count == 20_000)
    }
}
