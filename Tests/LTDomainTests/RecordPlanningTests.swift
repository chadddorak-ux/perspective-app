import Foundation
import Testing
@testable import LTDomain
import LTTestSupport

@Suite("Duplicates, merge and deletion planning (FR1, FR2, FR11)")
struct RecordPlanningTests {
    let now = TestDates.fixtureNow

    @Test func phoneNormalization() {
        #expect(ContactNormalizer.normalizePhone("+1 (555) 010-0001") == "+15550100001")
        #expect(ContactNormalizer.normalizePhone("0044 20 7946 0000") == "+442079460000")
        #expect(ContactNormalizer.phonesMatch("+1 (555) 010-0001", "555.010.0001"))
        #expect(!ContactNormalizer.phonesMatch("+1 555 010 0101", "+1 555 010 0199"))
        #expect(!ContactNormalizer.phonesMatch("12345", "912345"))
    }

    @Test func similarNamesWithDifferentNumbersAreNotDuplicates() {
        let fixtures = SyntheticFixtures()
        let candidates = DuplicateDetector.candidates(in: Array(fixtures.snapshot.people.values))
        #expect(candidates.isEmpty)
    }

    @Test func samePhoneOrEmailIsCandidateButDemoAndRealNeverMix() {
        let a = Person(displayName: "Sam R", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], createdAt: now)
        let b = Person(displayName: "Samuel Rivera", phoneNumbers: [LabeledValue(value: "(555) 010-0001")], emailAddresses: [LabeledValue(value: "S@Example.com")], createdAt: now)
        let c = Person(displayName: "Other", emailAddresses: [LabeledValue(value: "s@example.com ")], createdAt: now)
        let demo = Person(displayName: "Demo Sam", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], isDemo: true, createdAt: now)
        let candidates = DuplicateDetector.candidates(in: [a, b, c, demo])
        #expect(candidates.count == 2)
        #expect(candidates.allSatisfy { !Set([$0.first, $0.second]).contains(demo.id) })
    }

    @Test func mergePreservesEvidenceAndRemindersAndCanBeUndone() throws {
        let fixtures = SyntheticFixtures()
        var snapshot = fixtures.snapshot
        // A duplicate Maya created from Contacts with the same birthday plus a promise.
        let duplicate = Person(displayName: "Maya C.", phoneNumbers: [LabeledValue(value: "555 010 0333")], createdAt: now)
        snapshot.people[duplicate.id] = duplicate
        let dupBirthday = ImportantDate(personID: duplicate.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 10)!), createdAt: now)
        snapshot.importantDates[dupBirthday.id] = dupBirthday
        let promise = Promise(personIDs: [duplicate.id, fixtures.alex], description: "Plan dinner", createdAt: now)
        snapshot.promises[promise.id] = promise
        let original = snapshot

        let plan = try #require(MergePlanner.planMerge(keep: fixtures.maya, absorb: duplicate.id, in: snapshot, now: now))
        snapshot.apply(plan.changes)
        #expect(snapshot.people[duplicate.id] == nil)
        #expect(snapshot.people[fixtures.maya]?.phoneNumbers.map(\.value) == ["555 010 0333"])
        #expect(snapshot.importantDates[dupBirthday.id]?.personID == fixtures.maya)
        #expect(snapshot.promises[promise.id]?.personIDs == [fixtures.maya, fixtures.alex])
        #expect(plan.possibleDuplicateDates == [dupBirthday.id])
        #expect(snapshot.referentialProblems().isEmpty)

        snapshot.apply(plan.undoChanges)
        #expect(snapshot == original)
    }

    @Test func deletingSourceRemovesUnconfirmedDerivedDetailsAndInvalidatesCardsAndDrafts() {
        let fixtures = SyntheticFixtures()
        var snapshot = fixtures.snapshot
        let unconfirmed = Fact(personID: fixtures.alex, category: .family, label: "Daughter", value: "Maya", sourceID: fixtures.alexNote, excerpt: "Alex's daughter is Maya.", state: .unconfirmed, origin: .extracted, createdAt: now)
        snapshot.facts[unconfirmed.id] = unconfirmed
        let card = SuggestionRecord(occurrenceKey: "promise.due|\(fixtures.alexPromise)|2026-11-03", ruleID: .promiseDue, personID: fixtures.alex, evidence: [.promise(fixtures.alexPromise), .source(fixtures.alexNote)], reason: "Due tomorrow", scheduledFor: now, state: .visible, updatedAt: now)
        snapshot.suggestions[card.occurrenceKey] = card
        let draft = Draft(personID: fixtures.alex, evidence: [.source(fixtures.alexNote)], text: "Here is the photographer's number", createdAt: now)
        snapshot.drafts[draft.id] = draft

        let plan = DeletionPlanner.planSourceDeletion(fixtures.alexNote, in: snapshot, now: now)
        #expect(plan.removedFacts == [unconfirmed.id])
        // The promise is confirmed but default resolution removes derived details.
        #expect(plan.removedPromises == [fixtures.alexPromise])
        snapshot.apply(plan.changes)

        #expect(snapshot.sources[fixtures.alexNote] == nil)
        #expect(snapshot.facts[unconfirmed.id] == nil)
        #expect(snapshot.suggestions[card.occurrenceKey]?.state == .invalidated)
        #expect(snapshot.suggestions[card.occurrenceKey]?.reason == "")
        #expect(snapshot.drafts[draft.id]?.outcome == .invalidated)
        #expect(snapshot.drafts[draft.id]?.text == "")
        #expect(snapshot.referentialProblems().isEmpty)
        #expect(!containsText("photographer", in: snapshot))
    }

    @Test func deletingSourceCanKeepConfirmedDetailsWithoutExcerpt() {
        let fixtures = SyntheticFixtures()
        var snapshot = fixtures.snapshot
        let plan = DeletionPlanner.planSourceDeletion(fixtures.samNote, in: snapshot, resolution: .keepConfirmedAsOwnNotes, now: now)
        #expect(plan.keptFacts == [fixtures.samJobFact])
        #expect(plan.removedLifeEvents == [fixtures.samNewJob])
        snapshot.apply(plan.changes)
        let kept = snapshot.facts[fixtures.samJobFact]
        #expect(kept?.origin == .userAuthored)
        #expect(kept?.excerpt == nil)
        #expect(kept?.sourceID == nil)
        #expect(snapshot.referentialProblems().isEmpty)
        #expect(!containsText("Northwind", in: snapshot))
    }

    @Test func deletingPersonDetachesSharedNotesAndVoidsRuleApproval() {
        let fixtures = SyntheticFixtures()
        var snapshot = fixtures.snapshot
        let shared = Source(kind: .manualNote, capturedAt: now, text: "Dinner with Sam and Alex", personIDs: [fixtures.sam, fixtures.alex])
        snapshot.sources[shared.id] = shared
        let rule = AutomationRule(name: "Birthdays", recipients: [RuleRecipient(personID: fixtures.alex, address: "a"), RuleRecipient(personID: fixtures.sam, address: "s")], channel: .sms, trigger: .annualDate(.birthday), template: "Happy birthday, {name}!", expiresAt: now.addingTimeInterval(86_400 * 365), approval: RuleApproval(approvedAt: now, scopeDigest: "x", previewedExample: "Happy birthday, Alex!"), createdAt: now)
        snapshot.automationRules[rule.id] = rule

        let plan = DeletionPlanner.planPersonDeletion(fixtures.alex, in: snapshot, now: now)
        #expect(plan.exclusiveSources == [fixtures.alexNote])
        #expect(plan.sharedSources == [shared.id])
        #expect(plan.automationRulesChanged == 1)
        #expect(!plan.previewLines.isEmpty)
        snapshot.apply(plan.changes)

        #expect(snapshot.people[fixtures.alex] == nil)
        #expect(snapshot.sources[shared.id]?.personIDs == [fixtures.sam])
        #expect(snapshot.sources[fixtures.alexNote] == nil)
        #expect(snapshot.promises[fixtures.alexPromise] == nil)
        #expect(snapshot.automationRules[rule.id]?.approval == nil)
        #expect(snapshot.automationRules[rule.id]?.isPaused == true)
        #expect(snapshot.referentialProblems().isEmpty)
    }

    @Test func deletingPersonCanDeleteSharedNotes() {
        let fixtures = SyntheticFixtures()
        var snapshot = fixtures.snapshot
        let shared = Source(kind: .manualNote, capturedAt: now, text: "Dinner with Sam and Alex", personIDs: [fixtures.sam, fixtures.alex])
        snapshot.sources[shared.id] = shared
        let plan = DeletionPlanner.planPersonDeletion(fixtures.alex, in: snapshot, sharedSources: .delete, now: now)
        snapshot.apply(plan.changes)
        #expect(snapshot.sources[shared.id] == nil)
        #expect(snapshot.people[fixtures.sam] != nil)
        #expect(snapshot.referentialProblems().isEmpty)
    }

    /// Crude plaintext search across every string field via encoding.
    func containsText(_ needle: String, in snapshot: VaultSnapshot) -> Bool {
        let encoder = JSONEncoder()
        for record in snapshot.allRecords {
            let data: Data?
            switch record {
            case .person(let r): data = try? encoder.encode(r)
            case .source(let r): data = try? encoder.encode(r)
            case .fact(let r): data = try? encoder.encode(r)
            case .importantDate(let r): data = try? encoder.encode(r)
            case .interaction(let r): data = try? encoder.encode(r)
            case .promise(let r): data = try? encoder.encode(r)
            case .calendarLink(let r): data = try? encoder.encode(r)
            case .gift(let r): data = try? encoder.encode(r)
            case .suggestion(let r): data = try? encoder.encode(r)
            case .draft(let r): data = try? encoder.encode(r)
            case .connection(let r): data = try? encoder.encode(r)
            case .captureRecord(let r): data = try? encoder.encode(r)
            case .lifeEvent(let r): data = try? encoder.encode(r)
            case .trip(let r): data = try? encoder.encode(r)
            case .automationRule(let r): data = try? encoder.encode(r)
            case .actionAttempt(let r): data = try? encoder.encode(r)
            }
            if let data, String(decoding: data, as: UTF8.self).contains(needle) { return true }
        }
        return false
    }
}
