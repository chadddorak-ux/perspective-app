import Foundation
import Testing
@testable import LTSuggestions
import LTDomain
import LTTestSupport

@Suite("Deterministic suggestion engine (FR7)")
struct SuggestionEngineTests {
    let engine = SuggestionEngine()
    let fixtures = SyntheticFixtures()
    var context: EvaluationContext { EvaluationContext(now: TestDates.fixtureNow, timeZone: TestDates.newYork) }

    func evaluate(_ snapshot: VaultSnapshot, at context: EvaluationContext? = nil) -> SuggestionResult {
        engine.evaluate(snapshot, context: context ?? self.context)
    }

    @Test func fixtureProducesExpectedRankedCards() {
        let result = evaluate(fixtures.snapshot)
        #expect(result.visible.map(\.title) == [
            "You promised Alex Morgan: Send Alex the photographer's number",
            "Sam Rivera starts a new job today",
            "A date to keep in mind for Rachel Adams is in 2 days",
        ])
        #expect(result.more.map(\.title) == [
            "Maya Chen's birthday is in 8 days",
            "You last logged a conversation with Jeff Park on October 8. Have you caught up since?",
        ])
        let sam = result.visible[1]
        #expect(sam.detail == "You noted: excited about managing a team.")
        #expect(sam.allowsCelebration)
        #expect(sam.explanation.items.contains { $0.text.contains("He starts November 2.") })
        let rachel = result.visible[2]
        #expect(rachel.isSensitive)
        #expect(!rachel.allowsCelebration)
        #expect(result.visible[0].detail == "Due tomorrow")
    }

    @Test func everyCardExplainsItselfWithoutAModel() {
        let result = evaluate(fixtures.snapshot)
        for card in result.visible + result.more {
            #expect(!card.explanation.reason.isEmpty)
            #expect(!card.evidence.isEmpty)
            #expect(!card.actions.isEmpty)
        }
    }

    @Test func sameInputAndClockProduceSameCards() {
        let a = evaluate(fixtures.snapshot)
        let b = evaluate(fixtures.snapshot)
        #expect(a.visible == b.visible)
        #expect(a.more == b.more)
        #expect(a.stateChanges == b.stateChanges)
    }

    @Test func pausedPeopleGenerateNothing() {
        var snapshot = fixtures.snapshot
        for id in snapshot.people.keys { snapshot.people[id]?.reminderPreferences.isPaused = true }
        let result = evaluate(snapshot)
        #expect(result.visible.isEmpty && result.more.isEmpty)
    }

    @Test func archivedPeopleGenerateNothing() {
        var snapshot = fixtures.snapshot
        snapshot.people[fixtures.maya]?.isArchived = true
        let result = evaluate(snapshot)
        #expect(!(result.visible + result.more).contains { $0.personID == fixtures.maya })
    }

    @Test func dismissedOccurrenceDoesNotReturn() throws {
        var snapshot = fixtures.snapshot
        let first = evaluate(snapshot)
        snapshot.apply(first.stateChanges)
        let alexCard = try #require(first.visible.first)
        let dismissed = SuggestionTransitions.apply(.dismiss, to: alexCard, existing: snapshot.suggestions[alexCard.occurrenceKey], now: context.now)
        snapshot.apply(.upsert(.suggestion(dismissed)))
        let later = evaluate(snapshot, at: EvaluationContext(now: context.now.addingTimeInterval(3600), timeZone: TestDates.newYork))
        #expect(!(later.visible + later.more).contains { $0.occurrenceKey == alexCard.occurrenceKey })
    }

    @Test func snoozeIsAbsoluteAndSurvivesTimeZoneChange() throws {
        var snapshot = fixtures.snapshot
        let card = try #require(evaluate(snapshot).visible.first)
        let until = context.now.addingTimeInterval(6 * 3600)
        snapshot.apply(.upsert(.suggestion(SuggestionTransitions.apply(.snooze(until: until), to: card, existing: nil, now: context.now))))

        // Travelling west does not make the snooze expire early.
        let laContext = EvaluationContext(now: context.now.addingTimeInterval(3 * 3600), timeZone: TimeZone(identifier: "America/Los_Angeles")!)
        #expect(!(evaluate(snapshot, at: laContext).visible + evaluate(snapshot, at: laContext).more).contains { $0.occurrenceKey == card.occurrenceKey })

        let after = EvaluationContext(now: until.addingTimeInterval(1), timeZone: TestDates.newYork)
        let result = evaluate(snapshot, at: after)
        #expect(result.visible.contains { $0.occurrenceKey == card.occurrenceKey })
        // Expiry transitions the record back to visible exactly once.
        let reactivations = result.stateChanges.filter {
            if case .upsert(.suggestion(let r)) = $0 { return r.occurrenceKey == card.occurrenceKey && r.state == .visible }
            return false
        }
        #expect(reactivations.count == 1)
        snapshot.apply(result.stateChanges)
        let again = evaluate(snapshot, at: after)
        #expect(!again.stateChanges.contains {
            if case .upsert(.suggestion(let r)) = $0 { return r.occurrenceKey == card.occurrenceKey }
            return false
        })
    }

    @Test func atMostOneUnsolicitedCardPerPersonPerDay() {
        var snapshot = fixtures.snapshot
        let birthday = ImportantDate(personID: fixtures.alex, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 3)!), createdAt: context.now.addingTimeInterval(-86_400))
        snapshot.importantDates[birthday.id] = birthday
        snapshot.preferences.dailyCardLimit = 10
        let result = evaluate(snapshot)
        #expect(result.visible.filter { $0.personID == fixtures.alex }.count == 1)
        #expect(result.more.contains { $0.personID == fixtures.alex })

        // After dismissing the first Alex card, the second one does not appear the same day.
        snapshot.apply(result.stateChanges)
        let alexCard = result.visible.first { $0.personID == fixtures.alex }!
        snapshot.apply(.upsert(.suggestion(SuggestionTransitions.apply(.dismiss, to: alexCard, existing: snapshot.suggestions[alexCard.occurrenceKey], now: context.now))))
        let sameDay = evaluate(snapshot, at: EvaluationContext(now: context.now.addingTimeInterval(1800), timeZone: TestDates.newYork))
        #expect(!sameDay.visible.contains { $0.personID == fixtures.alex })
    }

    @Test func pinnedItemsStayVisibleAndUndatedPromisesStayQuiet() {
        var snapshot = fixtures.snapshot
        let undated = Promise(personIDs: [fixtures.jeff], description: "Lend Jeff the tent", createdAt: context.now.addingTimeInterval(-100))
        let pinned = Promise(personIDs: [fixtures.maya], description: "Book Maya's birthday dinner", isPinned: true, createdAt: context.now.addingTimeInterval(-100))
        snapshot.promises[undated.id] = undated
        snapshot.promises[pinned.id] = pinned
        snapshot.preferences.dailyCardLimit = 1
        let result = evaluate(snapshot)
        #expect(result.visible.first?.isPinned == true)
        #expect(result.visible.first?.title == "You promised Maya Chen: Book Maya's birthday dinner")
        #expect(!(result.visible + result.more).contains { $0.title.contains("tent") })
    }

    @Test func suggestionsCanBeDisabledAndLimitChanged() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.dailyCardLimit = 5
        #expect(evaluate(snapshot).visible.count == 5)
        snapshot.preferences.suggestionsEnabled = false
        let disabled = evaluate(snapshot)
        #expect(disabled.visible.isEmpty && disabled.more.isEmpty)
    }

    @Test func futureEvidenceCannotGenerateCards() {
        var snapshot = fixtures.snapshot
        let future = Source(kind: .manualNote, capturedAt: context.now.addingTimeInterval(86_400), text: "Future note", personIDs: [fixtures.jeff])
        snapshot.sources[future.id] = future
        let date = ImportantDate(personID: fixtures.jeff, category: .milestone, label: "Race", schedule: .once(CalendarDay(2026, 11, 3)), sourceID: future.id, createdAt: context.now)
        snapshot.importantDates[date.id] = date
        #expect(!(evaluate(snapshot).visible + evaluate(snapshot).more).contains { $0.title.contains("Race") })
    }

    @Test func deletedEvidenceInvalidatesRecord() {
        var snapshot = fixtures.snapshot
        let first = evaluate(snapshot)
        snapshot.apply(first.stateChanges)
        let key = first.visible[0].occurrenceKey
        snapshot.promises[fixtures.alexPromise] = nil
        let result = evaluate(snapshot)
        #expect(result.stateChanges.contains {
            if case .upsert(.suggestion(let r)) = $0 { return r.occurrenceKey == key && r.state == .invalidated && r.reason.isEmpty }
            return false
        })
    }

    @Test func sensitiveDatesRequireExplicitReminderSetting() {
        var snapshot = fixtures.snapshot
        snapshot.importantDates[fixtures.rachelDate]?.remindersEnabled = false
        #expect(!(evaluate(snapshot).visible + evaluate(snapshot).more).contains { $0.personID == fixtures.rachel })
    }

    @Test func unconfirmedDatesAndPromisesNeedReviewFirst() {
        var snapshot = fixtures.snapshot
        snapshot.importantDates[fixtures.mayaBirthday]?.confirmation = .unconfirmed
        snapshot.promises[fixtures.alexPromise]?.confirmation = .unconfirmed
        let all = evaluate(snapshot).visible + evaluate(snapshot).more
        #expect(!all.contains { $0.personID == fixtures.maya })
        #expect(!all.contains { $0.personID == fixtures.alex })
    }

    @Test func completingThisYearsBirthdayKeepsNextYears() {
        var snapshot = fixtures.snapshot
        snapshot.importantDates[fixtures.mayaBirthday]?.completedOccurrences = [CalendarDay(2026, 11, 10)]
        #expect(!(evaluate(snapshot).visible + evaluate(snapshot).more).contains { $0.personID == fixtures.maya })
        let nextYear = EvaluationContext(now: TestDates.instant(2027, 11, 1, 9), timeZone: TestDates.newYork)
        let cards = evaluate(snapshot, at: nextYear).visible + evaluate(snapshot, at: nextYear).more
        #expect(cards.contains { $0.title == "Maya Chen's birthday is in 9 days" })
    }

    @Test func yearBoundaryAndMissedExecution() {
        var snapshot = VaultSnapshot()
        let p = Person(displayName: "Nina", createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[p.id] = p
        let jan5 = ImportantDate(personID: p.id, category: .birthday, schedule: .annual(AnnualDate(month: 1, day: 5)!), createdAt: p.createdAt)
        snapshot.importantDates[jan5.id] = jan5
        let dec31 = EvaluationContext(now: TestDates.instant(2026, 12, 31, 10), timeZone: TestDates.newYork)
        #expect(evaluate(snapshot, at: dec31).visible.map(\.title) == ["Nina's birthday is in 5 days"])
        // Device did not run on the day; the card is still available the day after.
        let jan6 = EvaluationContext(now: TestDates.instant(2027, 1, 6, 10), timeZone: TestDates.newYork)
        #expect(evaluate(snapshot, at: jan6).visible.map(\.title) == ["Nina's birthday was yesterday"])
        let jan9 = EvaluationContext(now: TestDates.instant(2027, 1, 9, 10), timeZone: TestDates.newYork)
        #expect(evaluate(snapshot, at: jan9).visible.isEmpty)
    }

    @Test func birthdayDayFollowsCurrentTimeZone() {
        var snapshot = VaultSnapshot()
        let p = Person(displayName: "Kai", createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[p.id] = p
        let date = ImportantDate(personID: p.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 3)!), reminderOffsetsDays: [0], createdAt: p.createdAt)
        snapshot.importantDates[date.id] = date
        // 2026-11-03 02:00 UTC: still Nov 2 in New York, already Nov 3 in London.
        let instant = TestDates.instant(2026, 11, 3, 2, 0, in: TestDates.utc)
        #expect(evaluate(snapshot, at: EvaluationContext(now: instant, timeZone: TestDates.newYork)).visible.isEmpty)
        #expect(evaluate(snapshot, at: EvaluationContext(now: instant, timeZone: TimeZone(identifier: "Europe/London")!)).visible.map(\.title) == ["Kai's birthday is today"])
    }

    @Test func ageOnlyAppearsWithBirthYear() {
        var snapshot = fixtures.snapshot
        snapshot.importantDates[fixtures.mayaBirthday]?.schedule = .annual(AnnualDate(month: 11, day: 10, year: 1994)!)
        snapshot.preferences.dailyCardLimit = 10
        #expect(evaluate(snapshot).visible.contains { $0.title == "Maya Chen turns 32 in 8 days" })
    }

    @Test func leapDayWithoutChoiceProducesNoGuess() {
        var snapshot = VaultSnapshot()
        let p = Person(displayName: "Lee", createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[p.id] = p
        var date = ImportantDate(personID: p.id, category: .birthday, schedule: .annual(AnnualDate(month: 2, day: 29)!), createdAt: p.createdAt)
        snapshot.importantDates[date.id] = date
        let feb27 = EvaluationContext(now: TestDates.instant(2027, 2, 27, 10), timeZone: TestDates.newYork)
        #expect(evaluate(snapshot, at: feb27).visible.isEmpty)
        date.leapDayPolicy = .february28
        snapshot.importantDates[date.id] = date
        #expect(evaluate(snapshot, at: feb27).visible.map(\.title) == ["Lee's birthday is tomorrow"])
    }

    @Test func cadenceUsesOnlyRealInteractionsAndAsksForBaseline() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.dailyCardLimit = 10
        // A handed-off draft is not contact.
        let draft = Draft(personID: fixtures.jeff, text: "Hey Jeff", outcome: .handedOff, createdAt: context.now.addingTimeInterval(-3600))
        snapshot.drafts[draft.id] = draft
        #expect(evaluate(snapshot).visible.contains { $0.ruleID == .cadenceCheck && $0.personID == fixtures.jeff })
        // "We caught up yesterday" suppresses it.
        let caughtUp = Interaction(personIDs: [fixtures.jeff], kind: .call, occurredAt: context.now.addingTimeInterval(-86_400), confirmation: .userConfirmed, createdAt: context.now)
        snapshot.interactions[caughtUp.id] = caughtUp
        #expect(!evaluate(snapshot).visible.contains { $0.ruleID == .cadenceCheck })
        // No history at all: ask for a baseline instead of inventing one.
        snapshot.people[fixtures.maya]?.reminderPreferences.cadenceDays = 30
        // Maya's birthday card already uses her one unsolicited slot today, so this waits in "more".
        let baseline = evaluate(snapshot).more.first { $0.ruleID == .cadenceBaseline }
        #expect(baseline?.title == "When did you last catch up with Maya Chen?")
    }

    @Test func meetingsBriefBeforeAndAskAfterWithoutDuplicates() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.dailyCardLimit = 10
        let start = context.now.addingTimeInterval(5 * 3600)
        let link = CalendarLink(personIDs: [fixtures.jeff], calendarIdentifier: "cal", eventIdentifier: "evt-weekly", startsAt: start, endsAt: start.addingTimeInterval(3600), isRecurring: true, title: "Weekly sync", lastRefreshedAt: context.now, createdAt: context.now)
        var duplicate = link
        duplicate.id = CalendarLinkID()
        snapshot.calendarLinks[link.id] = link
        snapshot.calendarLinks[duplicate.id] = duplicate
        snapshot.people[fixtures.jeff]?.reminderPreferences.cadenceDays = nil
        let briefs = evaluate(snapshot).visible.filter { $0.ruleID == .meetingBrief }
        #expect(briefs.count == 1)
        #expect(briefs.first?.title.hasPrefix("Scheduled:") == true)

        let after = EvaluationContext(now: start.addingTimeInterval(2 * 3600), timeZone: TestDates.newYork)
        let followUps = evaluate(snapshot, at: after).visible.filter { $0.ruleID == .meetingFollowUp }
        #expect(followUps.count == 1)
        #expect(followUps.first?.actions.contains(.confirmAttendance) == true)

        snapshot.calendarLinks[link.id]?.status = .cancelled
        snapshot.calendarLinks[duplicate.id]?.status = .cancelled
        #expect(!evaluate(snapshot, at: after).visible.contains { $0.ruleID == .meetingFollowUp })
    }

    @Test func lifeUpdatesNeedRecentExplicitConfirmedDatedEvents() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.dailyCardLimit = 10
        // Second source reporting the same event yields one card.
        let other = Source(kind: .shareExtension, capturedAt: context.now.addingTimeInterval(-3600), text: "Sam: starting at Northwind today!", personIDs: [fixtures.sam])
        snapshot.sources[other.id] = other
        let dup = LifeEvent(personID: fixtures.sam, category: .newJob, summary: "Starts new job as team lead at Northwind", sourceIDs: [other.id], excerpt: "starting at Northwind today!", eventDay: CalendarDay(2026, 11, 2), capturedAt: other.capturedAt, confirmation: .confirmed, createdAt: other.capturedAt)
        snapshot.lifeEvents[dup.id] = dup
        #expect(evaluate(snapshot).visible.filter { $0.ruleID == .lifeUpdate }.count == 1)

        // An old announcement captured today is not a new-job alert.
        let old = LifeEvent(personID: fixtures.jeff, category: .newJob, summary: "Joined Contoso", sourceIDs: [other.id], excerpt: "x", eventDay: CalendarDay(2024, 3, 1), capturedAt: context.now.addingTimeInterval(-60), confirmation: .confirmed, createdAt: context.now)
        // No date at all: never an alert.
        let undated = LifeEvent(personID: fixtures.maya, category: .move, summary: "Moved to Denver", sourceIDs: [other.id], excerpt: "x", capturedAt: context.now.addingTimeInterval(-60), confirmation: .confirmed, createdAt: context.now)
        // Weak signal and unconfirmed: never alerts.
        let weak = LifeEvent(personID: fixtures.alex, category: .performance, summary: "Recital", sourceIDs: [other.id], excerpt: "x", eventDay: CalendarDay(2026, 11, 2), capturedAt: context.now.addingTimeInterval(-60), signal: .weak, confirmation: .confirmed, createdAt: context.now)
        let unconfirmed = LifeEvent(personID: fixtures.rachel, category: .graduation, summary: "Graduates", sourceIDs: [other.id], excerpt: "x", eventDay: CalendarDay(2026, 11, 2), capturedAt: context.now.addingTimeInterval(-60), createdAt: context.now)
        for e in [old, undated, weak, unconfirmed] { snapshot.lifeEvents[e.id] = e }
        let life = evaluate(snapshot).visible.filter { $0.ruleID == .lifeUpdate }
        #expect(life.map(\.personID) == [fixtures.sam])
    }

    @Test func travelOverlapUsesUserEnteredCitiesAndFlagsUncertainty() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.dailyCardLimit = 10
        let trip = Trip(city: "chicago", startDay: CalendarDay(2026, 11, 10), endDay: CalendarDay(2026, 11, 12), createdAt: context.now)
        snapshot.trips[trip.id] = trip
        let travel = (evaluate(snapshot).visible + evaluate(snapshot).more).filter { $0.ruleID == .travelOverlap }
        #expect(Set(travel.map(\.personID)) == [fixtures.sam, fixtures.alex])
        #expect(travel.contains { $0.title == "You'll be in chicago next week; want to see Alex Morgan?" })
        snapshot.trips[trip.id]?.isUncertain = true
        let uncertain = (evaluate(snapshot).visible + evaluate(snapshot).more).filter { $0.ruleID == .travelOverlap }
        #expect(uncertain.allSatisfy { $0.title.contains("might be") && $0.title.contains("plans not confirmed") })
    }

    @Test func tonightRespectsQuietHours() {
        let morning = EvaluationContext(now: TestDates.instant(2026, 11, 2, 9), timeZone: TestDates.newYork)
        #expect(SuggestionTransitions.tonight(context: morning, quietHours: QuietHours()) == TestDates.instant(2026, 11, 2, 19))
        let late = EvaluationContext(now: TestDates.instant(2026, 11, 2, 20), timeZone: TestDates.newYork)
        #expect(SuggestionTransitions.tonight(context: late, quietHours: QuietHours()) == TestDates.instant(2026, 11, 3, 19))
        let early = QuietHours(start: TimeOfDay(hour: 18), end: TimeOfDay(hour: 7))
        #expect(SuggestionTransitions.tonight(context: morning, quietHours: early) == TestDates.instant(2026, 11, 3, 7))
    }
}
