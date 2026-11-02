import Foundation
import Testing
@testable import LTIntegrations
import LTDomain
import LTSuggestions
import LTTestSupport

@Suite("Capability registry (FR12)")
struct CapabilityRegistryTests {
    @Test func bundledCatalogCoversEveryRequiredChannelHonestly() throws {
        let registry = try IntegrationCapabilityRegistry.bundled()
        #expect(registry.entries.count >= 40)
        for channel in IntegrationCapabilityRegistry.requiredChannels {
            #expect(!registry.entries(forChannel: channel).isEmpty, "missing channel \(channel)")
        }
        // Nothing has been proven against a real account in this build.
        #expect(registry.entries.allSatisfy { !$0.testedInApp })
        // Every researched route cites sources or is explicitly not investigated.
        #expect(registry.entries.allSatisfy { !$0.docs.isEmpty || $0.status == .notInvestigated })
        #expect(registry.entries.allSatisfy { !$0.nextExperiment.isEmpty })
        // Every route this build claims to implement exists in the catalog.
        for id in IntegrationCapabilityRegistry.builtInImplementation.keys {
            #expect(registry.entry(id) != nil, "implementation refers to unknown route \(id)")
        }
    }

    @Test func bundledCatalogMatchesDocumentation() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let docs = try Data(contentsOf: root.appendingPathComponent("docs/integrations/capability-matrix.json"))
        let bundled = try Data(contentsOf: root.appendingPathComponent("Sources/LTIntegrations/Resources/capability-matrix.json"))
        #expect(docs == bundled, "Copy docs/integrations/capability-matrix.json into Sources/LTIntegrations/Resources/")
    }

    @Test func unsupportedSourcesNeverOfferAFakeConnect() throws {
        let registry = try IntegrationCapabilityRegistry.bundled()
        for entry in registry.entries where registry.implementation[entry.id] == nil {
            let summary = registry.summary(for: entry, now: Date())
            #expect(!summary.canConnect)
            #expect(!summary.isAutomatic)
        }
        let whatsapp = try #require(registry.entry("whatsapp-chat-export"))
        let summary = registry.summary(for: whatsapp, now: Date())
        #expect(summary.canConnect)
        #expect(!summary.isAutomatic)
        #expect(summary.statusLine.contains("nothing is monitored"))
    }

    @Test func deniedPermissionIsShownHonestly() throws {
        var registry = try IntegrationCapabilityRegistry.bundled()
        registry.deviceState["calendar-eventkit-full-access"] = DeviceCapabilityState(permission: .denied)
        let entry = try #require(registry.entry("calendar-eventkit-full-access"))
        #expect(registry.summary(for: entry, now: Date()).statusLine == "Access is off in Settings")
    }
}

@Suite("Local notification planning (FR10)")
struct NotificationPlannerTests {
    let planner = NotificationPlanner()
    let fixtures = SyntheticFixtures()
    var context: EvaluationContext { EvaluationContext(now: TestDates.fixtureNow, timeZone: TestDates.newYork) }

    @Test func genericByDefaultWithOpaqueIdentifiers() {
        let planned = planner.plan(fixtures.snapshot, context: context)
        #expect(!planned.isEmpty)
        for n in planned {
            #expect(n.title == NotificationPlanner.genericTitle)
            #expect(n.body == NotificationPlanner.genericBody)
            #expect(n.identifier.hasPrefix("lt."))
            #expect(n.identifier.dropFirst(3).allSatisfy { $0.isHexDigit })
        }
    }

    @Test func detailedOptInNeverRevealsSensitiveItems() {
        var snapshot = fixtures.snapshot
        snapshot.preferences.notificationPrivacy = .detailed
        let planned = planner.plan(snapshot, context: context)
        #expect(planned.contains { $0.title.contains("Maya Chen") })
        let sensitive = planned.filter(\.isSensitive)
        #expect(!sensitive.isEmpty)
        for n in sensitive {
            #expect(n.body == NotificationPlanner.genericBody)
            #expect(!n.title.contains("Rachel") && !n.body.contains("passing"))
        }
        for n in planned { #expect(!n.identifier.contains("Maya")) }
    }

    @Test func birthdayGetsPlanningAndDayOfReminders() {
        let planned = planner.plan(fixtures.snapshot, context: context).filter { $0.kind == .dateReminder }
        let fireDays = Set(planned.map { CalendarDay(date: $0.trigger.fireDate(in: TestDates.newYork), timeZone: TestDates.newYork) })
        // Maya's Nov 10 day-of reminder; the 14-day reminder (Oct 27) is already past.
        #expect(fireDays.contains(CalendarDay(2026, 11, 10)))
        // Rachel's careful date: 3-day and day-of reminders.
        #expect(fireDays.contains(CalendarDay(2026, 11, 4)))
    }

    @Test func planningIsIdempotentAndReconcileConverges() {
        let first = planner.plan(fixtures.snapshot, context: context)
        let second = planner.plan(fixtures.snapshot, context: context)
        #expect(first == second)
        let initial = NotificationPlanner.reconcile(desired: first, pendingIdentifiers: [], authorization: .authorized)
        #expect(initial.add.count == first.count && initial.remove.isEmpty)
        let again = NotificationPlanner.reconcile(desired: second, pendingIdentifiers: first.map(\.identifier), authorization: .authorized)
        #expect(again.add.isEmpty && again.remove.isEmpty)
    }

    @Test func pausedArchivedAndDeletedPeopleHaveNoPendingNotifications() {
        var snapshot = fixtures.snapshot
        snapshot.people[fixtures.maya]?.reminderPreferences.isPaused = true
        snapshot.people[fixtures.alex]?.isArchived = true
        let plan = DeletionPlanner.planPersonDeletion(fixtures.rachel, in: snapshot, now: context.now)
        snapshot.apply(plan.changes)
        snapshot.preferences.notificationPrivacy = .detailed
        let planned = planner.plan(snapshot, context: context)
        #expect(!planned.contains { $0.title.contains("Maya") || $0.title.contains("Alex") || $0.title.contains("Rachel") || $0.body.contains("Rachel") })
        #expect(!planned.contains { $0.kind == .dateReminder })
    }

    @Test func completingPromiseRemovesItsNotificationAndEditingReschedules() {
        var snapshot = fixtures.snapshot
        let before = planner.plan(snapshot, context: context).filter { $0.kind == .promiseDue }
        #expect(before.count == 1)
        snapshot.promises[fixtures.alexPromise]?.due = .day(CalendarDay(2026, 11, 5))
        let moved = planner.plan(snapshot, context: context).filter { $0.kind == .promiseDue }
        #expect(moved.count == 1 && moved[0].identifier != before[0].identifier)
        let diff = NotificationPlanner.reconcile(desired: moved, pendingIdentifiers: before.map(\.identifier), authorization: .authorized)
        #expect(diff.remove == before.map(\.identifier))
        snapshot.promises[fixtures.alexPromise]?.status = .done
        #expect(planner.plan(snapshot, context: context).filter { $0.kind == .promiseDue }.isEmpty)
    }

    @Test func deniedPermissionSchedulesNothingAndClearsOurs() {
        let planned = planner.plan(fixtures.snapshot, context: context)
        let diff = NotificationPlanner.reconcile(desired: planned, pendingIdentifiers: ["lt.abc", "other.app.thing"], authorization: .denied)
        #expect(diff.add.isEmpty)
        #expect(diff.remove == ["lt.abc"])
    }

    @Test func quietHoursAreRespected() {
        var snapshot = fixtures.snapshot
        snapshot.importantDates[fixtures.mayaBirthday]?.reminderTime = TimeOfDay(hour: 23)
        snapshot.preferences.quietHours = QuietHours(start: TimeOfDay(hour: 22), end: TimeOfDay(hour: 7))
        for n in planner.plan(snapshot, context: context) {
            let time = TimeOfDay(date: n.trigger.fireDate(in: TestDates.newYork), timeZone: TestDates.newYork)
            #expect(!snapshot.preferences.quietHours.contains(time), "\(n.kind) at \(time)")
        }
    }

    @Test func dateRemindersFloatWithTimeZoneWhileSnoozesStayAbsolute() throws {
        var snapshot = fixtures.snapshot
        let card = try #require(SuggestionEngine().evaluate(snapshot, context: context).visible.first)
        let until = context.now.addingTimeInterval(5 * 3600)
        snapshot.apply(.upsert(.suggestion(SuggestionTransitions.apply(.snooze(until: until), to: card, existing: nil, now: context.now))))
        let planned = planner.plan(snapshot, context: context)
        let snoozes = planned.filter { $0.kind == .snoozedCard }
        #expect(snoozes.count == 1)
        #expect(snoozes[0].trigger == .absolute(until))
        let birthday = try #require(planned.first { $0.kind == .dateReminder && $0.trigger == .floating(CalendarDay(2026, 11, 10), .morning) })
        let la = TimeZone(identifier: "America/Los_Angeles")!
        #expect(birthday.trigger.fireDate(in: la).timeIntervalSince(birthday.trigger.fireDate(in: TestDates.newYork)) == 3 * 3600)
    }

    @Test func atMostOneDigestPerDay() {
        let planned = planner.plan(fixtures.snapshot, context: context).filter { $0.kind == .digest }
        let days = planned.map { CalendarDay(date: $0.trigger.fireDate(in: TestDates.newYork), timeZone: TestDates.newYork) }
        #expect(Set(days).count == days.count)
        var noDigest = fixtures.snapshot
        noDigest.preferences.maxDigestsPerDay = 0
        #expect(planner.plan(noDigest, context: context).filter { $0.kind == .digest }.isEmpty)
    }

    @Test func windowIsBounded() {
        var snapshot = VaultSnapshot()
        let created = context.now.addingTimeInterval(-86_400)
        for i in 0..<60 {
            let p = Person(displayName: "Person \(i)", createdAt: created)
            snapshot.people[p.id] = p
            let d = ImportantDate(personID: p.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 3 + (i % 10))!), createdAt: created)
            snapshot.importantDates[d.id] = d
        }
        let planned = NotificationPlanner(maxPending: 48).plan(snapshot, context: context)
        #expect(planned.count == 48)
        let fireDates = planned.map { $0.trigger.fireDate(in: TestDates.newYork) }
        #expect(fireDates == fireDates.sorted())
    }
}

@Suite("Calendar and contacts adapters (FR1, FR6)")
struct CalendarContactsTests {
    let now = TestDates.fixtureNow

    func link(recurring: Bool = false) -> CalendarLink {
        CalendarLink(personIDs: [PersonID()], calendarIdentifier: "cal", eventIdentifier: "evt", startsAt: now.addingTimeInterval(3600), endsAt: now.addingTimeInterval(7200), isRecurring: recurring, title: "Coffee", lastRefreshedAt: now.addingTimeInterval(-86_400), createdAt: now)
    }

    @Test func movedCancelledAndMissingEventsUpdateOnRefresh() {
        let original = link()
        let moved = CalendarEventInfo(eventIdentifier: "evt", calendarIdentifier: "cal", title: "Coffee", startsAt: now.addingTimeInterval(86_400), endsAt: now.addingTimeInterval(90_000))
        var changes = CalendarReconciler.reconcile([original], with: .events([original.id: moved]), cacheTitles: true, now: now)
        guard case .upsert(.calendarLink(let updated)) = changes.first else { Issue.record("expected update"); return }
        #expect(updated.startsAt == moved.startsAt)
        #expect(updated.occurrenceStart == moved.startsAt)
        #expect(updated.lastRefreshedAt == now)

        var cancelled = moved
        cancelled.isCancelled = true
        changes = CalendarReconciler.reconcile([original], with: .events([original.id: cancelled]), cacheTitles: true, now: now)
        if case .upsert(.calendarLink(let c)) = changes.first { #expect(c.status == .cancelled) } else { Issue.record("expected cancel") }

        let gone: [CalendarLinkID: CalendarEventInfo?] = [original.id: Optional<CalendarEventInfo>.none]
        changes = CalendarReconciler.reconcile([original], with: .events(gone), cacheTitles: true, now: now)
        if case .upsert(.calendarLink(let m)) = changes.first { #expect(m.status == .missing) } else { Issue.record("expected missing") }

        #expect(CalendarReconciler.reconcile([original], with: .accessUnavailable, cacheTitles: true, now: now).isEmpty)
    }

    @Test func titlesAreNotCachedWhenUserOptsOut() {
        let event = CalendarEventInfo(eventIdentifier: "e", calendarIdentifier: "c", title: "Therapy", startsAt: now, endsAt: now.addingTimeInterval(3600))
        let created = CalendarReconciler.link(for: event, people: [PersonID()], context: .personal, cacheTitles: false, now: now)
        #expect(created.title == nil)
    }

    @Test func onlyConfirmedAttendanceCreatesInteraction() {
        let l = link()
        let yes = CalendarReconciler.confirmAttendance(l, happened: true, now: now)
        #expect(yes.contains { if case .upsert(.interaction(let i)) = $0 { return i.confirmation == .userConfirmed } else { return false } })
        let no = CalendarReconciler.confirmAttendance(l, happened: false, now: now)
        #expect(!no.contains { if case .upsert(.interaction) = $0 { return true } else { return false } })
    }

    @Test func contactImportTakesOnlySelectedFieldsAndBirthdayNeedsReview() {
        let contact = ImportedContact(identifier: "ABC", givenName: "Maya", familyName: "Chen", nickname: "May", phoneNumbers: [LabeledValue(label: "mobile", value: "+1 555 010 0003")], emailAddresses: [], birthday: AnnualDate(month: 11, day: 10))
        let plan = ContactImportPlanner.plan(for: contact, now: now)
        #expect(plan.person.displayName == "Maya Chen")
        #expect(plan.person.preferredName == "May")
        #expect(plan.person.address == nil)
        #expect(plan.person.contactReference?.identifier == "ABC")
        #expect(plan.birthdayCandidate?.confirmation == .unconfirmed)
        #expect(plan.birthdayCandidate?.sourceID == plan.source.id)
    }

    @Test func refreshNeverOverwritesUserEnteredFields() {
        let contact = ImportedContact(identifier: "ABC", givenName: "Maya", familyName: "Chen", phoneNumbers: [LabeledValue(value: "+1 555 010 0003")])
        var person = ContactImportPlanner.plan(for: contact, now: now).person
        person.address = "12 Elm St"
        person.notes = "Loves jazz"
        var changed = contact
        changed.phoneNumbers.append(LabeledValue(label: "work", value: "+1 555 010 0004"))
        let refreshed = ContactImportPlanner.refresh(person, from: changed, now: now)
        #expect(refreshed?.phoneNumbers.count == 2)
        #expect(refreshed?.address == "12 Elm St")
        #expect(refreshed?.notes == "Loves jazz")
        var other = changed
        other.identifier = "XYZ"
        #expect(ContactImportPlanner.refresh(person, from: other, now: now) == nil)
    }
}
