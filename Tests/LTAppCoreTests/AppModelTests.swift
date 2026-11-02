import Foundation
import Testing
@testable import LTAppCore
import LTCapture
import LTCryptoSupport
import LTDomain
import LTIntegrations
import LTIntelligence
import LTPolicy
import LTSuggestions
import LTTestSupport
import LTVault

@MainActor
@Suite("App model end to end (P0 flows)")
struct AppModelTests {
    func readyModel(_ env: TestEnvironment) async -> AppModel {
        let model = AppModel(environment: env.environment)
        model.start()
        await model.createVault()
        return model
    }

    @Test func onboardingWorksWithoutAnyPermission() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = AppModel(environment: env.environment)
        model.start()
        #expect(model.phase == .onboarding)
        await model.createVault()
        #expect(model.phase == .ready)

        let sam = try await model.addPerson(Person(displayName: "Sam Rivera", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], createdAt: TestDates.fixtureNow))
        try await model.save(ImportantDate(personID: sam.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 9)!), createdAt: TestDates.fixtureNow))
        #expect(model.today.visible.map(\.title) == ["Sam Rivera's birthday is in 7 days"])
        try await model.save(Promise(personIDs: [sam.id], description: "Send Sam the book recommendation", due: .day(CalendarDay(2026, 11, 3)), createdAt: TestDates.fixtureNow))
        // The birthday card already holds Sam's one unsolicited slot today; cards the user has
        // seen don't reshuffle, so the promise waits in "More" until tomorrow.
        #expect(model.today.visible.map(\.title) == ["Sam Rivera's birthday is in 7 days"])
        #expect(model.today.more.map(\.title) == ["You promised Sam Rivera: Send Sam the book recommendation"])
        // Permission is never requested implicitly, and nothing is scheduled without it.
        #expect(env.notifications.requestCount == 0)
        #expect(env.notifications.pending.isEmpty)
    }

    @Test func recordsSurviveRestartAndUnlockRequiresAuthentication() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let p = try await model.addPerson(Person(displayName: "Maya Chen", createdAt: TestDates.fixtureNow))
        await model.lock()
        #expect(model.phase == .locked)
        #expect(model.snapshot.people.isEmpty) // plaintext dropped from memory

        // "Restart": a new model over the same device state.
        let relaunched = AppModel(environment: env.environment)
        relaunched.start()
        #expect(relaunched.phase == .locked)
        env.keyStore.authenticationSucceeds = false
        await relaunched.unlock()
        #expect(relaunched.phase == .locked)
        #expect(relaunched.snapshot.people.isEmpty)
        env.keyStore.authenticationSucceeds = true
        await relaunched.unlock()
        #expect(relaunched.phase == .ready)
        #expect(relaunched.snapshot.people[p.id]?.displayName == "Maya Chen")
    }

    @Test func backgroundTimeoutRelocks() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        model.didEnterBackground()
        env.clock.advance(by: 30)
        await model.willEnterForeground()
        #expect(model.phase == .ready)
        model.didEnterBackground()
        env.clock.advance(by: 61)
        await model.willEnterForeground()
        #expect(model.phase == .locked)
    }

    @Test func noPasscodeBlocksRealDataButDemoWorksSeparately() async throws {
        let env = TestEnvironment(protection: .passcodeNotSet); defer { env.directory.cleanup() }
        let model = AppModel(environment: env.environment)
        model.start()
        await model.createVault()
        guard case .protectionRequired = model.phase else { Issue.record("expected protection gate"); return }
        #expect(try env.keyStore.hasKey() == false)

        await model.startDemo()
        #expect(model.isDemo)
        let allDemo = model.snapshot.people.values.allSatisfy { $0.isDemo }
        #expect(allDemo)
        #expect(!model.today.visible.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: env.environment.databaseURL.path))
        await model.exitDemo()
        #expect(model.snapshot.people.isEmpty)
        #expect(!model.isDemo)
    }

    @Test func dismissedCardsStayDismissedAcrossRestart() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let alex = try await model.addPerson(Person(displayName: "Alex Morgan", createdAt: TestDates.fixtureNow))
        try await model.save(Promise(personIDs: [alex.id], description: "Return the ladder", due: .day(CalendarDay(2026, 11, 2)), createdAt: TestDates.fixtureNow))
        let card = try #require(model.today.visible.first)
        try await model.perform(.dismiss, on: card)
        #expect(model.today.visible.isEmpty)
        await model.lock()

        let relaunched = AppModel(environment: env.environment)
        relaunched.start()
        await relaunched.unlock()
        #expect(!relaunched.today.visible.contains { $0.occurrenceKey == card.occurrenceKey })
    }

    @Test func memoryCaptureProposesGroundedItemsAndConfirmsWithProvenance() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let alex = try await model.addPerson(Person(displayName: "Alex Morgan", phoneNumbers: [LabeledValue(value: "+1 555 010 0004")], createdAt: TestDates.fixtureNow))
        let capture = try await model.addMemory("Alex's daughter is Maya. Her recital is December 12. I promised to send him the photographer's number tomorrow.", people: [alex.id])
        #expect(!capture.usedLocalModel)
        #expect(model.snapshot.sources[capture.source.id] != nil) // original note retained
        #expect(model.snapshot.facts.isEmpty) // nothing saved before review

        var selection = ProposalSelection()
        selection.facts = capture.proposal.facts.map { ($0, alex.id) }
        selection.dates = capture.proposal.dates.map { ($0, alex.id, nil) }
        selection.promises = capture.proposal.promises.map { ($0, [alex.id]) }
        try await model.confirm(selection, from: capture.source)

        #expect(model.snapshot.facts.values.allSatisfy { $0.sourceID == capture.source.id && $0.excerpt != nil && $0.state == .confirmed })
        #expect(model.snapshot.importantDates.values.contains { $0.label == "Maya's recital" && $0.schedule == .once(CalendarDay(2026, 12, 12)) })
        #expect(model.today.visible.contains { $0.ruleID == .promiseDue })
    }

    @Test func localModelOutputIsValidatedNotTrusted() async throws {
        let invented = RawExtraction(
            facts: [RawFact(personName: "Alex", category: "interest", label: "Interest", value: "sailing", excerpt: "Alex loves sailing.")],
            promises: [RawPromise(personName: "Alex", description: "Wire Alex $500", owner: "me", excerpt: "We had coffee.")]
        )
        let env = TestEnvironment(localModel: FakeLocalModel(output: invented)); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let alex = try await model.addPerson(Person(displayName: "Alex Morgan", createdAt: TestDates.fixtureNow))
        let capture = try await model.addMemory("We had coffee.", people: [alex.id])
        #expect(capture.usedLocalModel)
        #expect(capture.proposal.isEmpty)
        #expect(capture.proposal.rejected.count == 2)
    }

    @Test func scopedAutoSaveSavesOnlyExplicitDetailsAsUnconfirmed() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        var prefs = model.snapshot.preferences
        prefs.autoSaveProviders = [SourceKind.manualNote.rawValue]
        try await model.updatePreferences(prefs)
        let alex = try await model.addPerson(Person(displayName: "Alex Morgan", createdAt: TestDates.fixtureNow))
        let capture = try await model.addMemory("Alex's daughter is Maya. Her recital is December 12. I promised to call him.", people: [alex.id])
        #expect(capture.autoSavedCount == 1) // the fact; the year-less date and the promise need review
        #expect(model.snapshot.facts.values.allSatisfy { $0.origin == .autoSaved && $0.state == .unconfirmed })
        #expect(model.snapshot.promises.isEmpty)
        #expect(model.reviewQueue.contains { if case .fact = $0 { return true } else { return false } })
    }

    @Test func draftCancelAndSendOutcomesAreRecordedPrecisely() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let sam = try await model.addPerson(Person(displayName: "Sam Rivera", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], createdAt: TestDates.fixtureNow))
        try await model.save(ImportantDate(personID: sam.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 2)!), createdAt: TestDates.fixtureNow))
        let card = try #require(model.today.visible.first)
        let draft = try await model.makeDraft(for: card, tone: .warm)
        #expect(draft.text == "Happy birthday, Sam Rivera! Hope your day is a good one.")
        #expect(draft.recipient?.address == "+1 555 010 0001")
        guard case .execute = model.prepareHandoff(draft) else { Issue.record("user handoff should be allowed"); return }

        try await model.recordComposerResult(.cancelled, for: draft.id)
        #expect(model.snapshot.interactions.isEmpty)
        #expect(model.snapshot.drafts[draft.id]?.outcome == .cancelled)

        let second = try await model.makeDraft(for: card, tone: .simple)
        try await model.recordComposerResult(.sent, for: second.id)
        #expect(model.snapshot.drafts[second.id]?.outcome == .systemReportedSent)
        #expect(model.snapshot.interactions.count == 1)

        var wrong = second
        wrong.recipient?.address = "+1 555 999 0000"
        guard case .requireReview = model.prepareHandoff(wrong) else { Issue.record("changed recipient must be reviewed"); return }
    }

    @Test func pausingAPersonSilencesCardsAndNotifications() async throws {
        let env = TestEnvironment(notifications: FakeNotificationScheduler(authorization: .authorized)); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let maya = try await model.addPerson(Person(displayName: "Maya Chen", createdAt: TestDates.fixtureNow))
        try await model.save(ImportantDate(personID: maya.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 5)!), createdAt: TestDates.fixtureNow))
        #expect(!model.today.visible.isEmpty)
        #expect(!env.notifications.pending.isEmpty)
        #expect(env.notifications.pending.allSatisfy { $0.body == NotificationPlanner.genericBody })
        try await model.setPaused(maya.id, true)
        #expect(model.today.visible.isEmpty)
        #expect(env.notifications.pending.isEmpty)
    }

    @Test func deletingAPersonRemovesTheirDataAndNotifications() async throws {
        let env = TestEnvironment(notifications: FakeNotificationScheduler(authorization: .authorized)); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let maya = try await model.addPerson(Person(displayName: "Maya Chen", createdAt: TestDates.fixtureNow))
        try await model.save(ImportantDate(personID: maya.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 5)!), createdAt: TestDates.fixtureNow))
        _ = try await model.addMemory("Maya loves watercolor.", people: [maya.id])
        let plan = model.deletionPreview(for: maya.id)
        #expect(!plan.previewLines.isEmpty)
        try await model.deletePerson(plan)
        #expect(model.snapshot.people.isEmpty && model.snapshot.sources.isEmpty && model.snapshot.importantDates.isEmpty)
        #expect(env.notifications.pending.isEmpty)
        #expect(model.search("watercolor").isEmpty)
    }

    @Test func shareInboxItemsAreSealedDrainedOnceAndDeleted() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let publicKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: model.shareInboxPublicKey())
        let inbox = try #require(env.environment.shareInboxDirectory)
        // What the share extension does: it only knows the public key.
        for text in ["Jeff is moving to Denver in March!", "Jeff is moving to Denver in March!"] {
            let item = InboxItem(receivedAt: TestDates.fixtureNow, text: text)
            try ShareInbox.seal(item, to: publicKey).write(to: inbox.appendingPathComponent(ShareInbox.fileName(for: item)))
        }
        let captures = await model.drainShareInbox()
        #expect(captures.count == 1) // the second is a duplicate
        #expect(model.snapshot.sources.values.filter { $0.kind == .shareExtension }.count == 1)
        #expect(try FileManager.default.contentsOfDirectory(atPath: inbox.path).isEmpty)
    }

    @Test func backupRestoreRoundTripsToANewDevice() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        _ = try await model.addPerson(Person(displayName: "Rachel Adams", createdAt: TestDates.fixtureNow))
        await #expect(throws: AppError.recoveryKeyMissing) { _ = try await model.exportBackup() }
        let (recovery, isNew) = try model.recoveryKey(createIfMissing: true)
        #expect(isNew)
        try model.confirmRecoveryKeySaved(recovery)
        let archive = try await model.exportBackup()
        #expect(model.snapshot.preferences.lastBackupAt == TestDates.fixtureNow)

        let other = TestEnvironment(); defer { other.directory.cleanup() }
        let newDevice = await readyModel(other)
        #expect(throws: BackupError.self) { try newDevice.previewRestore(archive, recoveryKeyText: RecoveryKey.generate().displayString) }
        let preview = try newDevice.previewRestore(archive, recoveryKeyText: recovery.displayString)
        #expect(preview.people == 1)
        try await newDevice.restore(archive, recoveryKeyText: recovery.displayString)
        #expect(newDevice.snapshot.people.values.map(\.displayName) == ["Rachel Adams"])
    }

    @Test func deleteEverythingReturnsToOnboardingWithNoRecoverableKey() async throws {
        let env = TestEnvironment(notifications: FakeNotificationScheduler(authorization: .authorized)); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let maya = try await model.addPerson(Person(displayName: "Maya Chen", createdAt: TestDates.fixtureNow))
        try await model.save(ImportantDate(personID: maya.id, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 5)!), createdAt: TestDates.fixtureNow))
        _ = try model.shareInboxPublicKey()
        try model.confirmRecoveryKeySaved(RecoveryKey.generate())
        await model.deleteEverything()
        #expect(model.phase == .onboarding)
        #expect(try env.keyStore.hasKey() == false)
        #expect(env.secrets.isEmpty)
        #expect(env.notifications.pending.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: env.environment.vaultDirectory.path))
        let relaunched = AppModel(environment: env.environment)
        relaunched.start()
        #expect(relaunched.phase == .onboarding)
    }

    @Test func mergeCanBeUndoneWithinTheSession() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let a = try await model.addPerson(Person(displayName: "Sam Rivera", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], createdAt: TestDates.fixtureNow))
        let b = try await model.addPerson(Person(displayName: "Sam R.", phoneNumbers: [LabeledValue(value: "555-010-0001")], createdAt: TestDates.fixtureNow))
        #expect(model.duplicateCandidates.count == 1)
        let before = model.snapshot.people
        try await model.merge(keep: a.id, absorb: b.id)
        #expect(model.snapshot.people.count == 1)
        try await model.undoLastMerge()
        #expect(model.snapshot.people == before)
        await #expect(throws: AppError.nothingToUndo) { try await model.undoLastMerge() }
    }

    @Test func whatsAppImportDrivesAnHonestRhythmCard() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let jeff = try await model.addPerson(Person(displayName: "Jeff Park", reminderPreferences: ReminderPreferences(observedPatternEnabled: true), createdAt: TestDates.fixtureNow))
        var lines = ["[6/1/26, 10:00:00 AM] Jeff Park: hello"]
        for offset in stride(from: 45, through: 0, by: -5) {
            let day = CalendarDay(2026, 10, 10).adding(days: -offset)
            lines.append("[\(day.month)/\(day.day)/26, 12:00:00 PM] Jeff Park: hi")
        }
        let (_, plan) = model.previewWhatsAppImport(lines.joined(separator: "\n"), selfName: "Me", mapping: ["Jeff Park": jeff.id])
        try await model.commitImport(plan)
        let card = try #require(model.today.visible.first { $0.ruleID == .rhythmLull })
        #expect(card.explanation.coverage?.contains("WhatsApp chat export") == true)
        let connection = try #require(model.snapshot.connections.values.first)
        try await model.revoke(connection.id, deleteImported: true)
        #expect(!model.today.visible.contains { $0.ruleID == .rhythmLull })
        #expect(model.snapshot.interactions.isEmpty)
    }

    @Test func calendarRefreshHonorsDeniedAccessAndUpdatesMovedEvents() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let alex = try await model.addPerson(Person(displayName: "Alex Morgan", createdAt: TestDates.fixtureNow))
        let start = TestDates.fixtureNow.addingTimeInterval(3 * 3600)
        let event = CalendarEventInfo(eventIdentifier: "evt", calendarIdentifier: "cal", title: "Lunch", startsAt: start, endsAt: start.addingTimeInterval(3600))
        try await model.linkCalendarEvent(event, people: [alex.id], context: .personal)
        #expect(model.today.visible.contains { $0.ruleID == .meetingBrief })

        let denied = FakeCalendarProvider(state: .denied)
        #expect(await model.refreshCalendar(using: denied) == .denied)
        #expect(model.snapshot.calendarLinks.values.first?.startsAt == start)

        var moved = event
        moved.startsAt = start.addingTimeInterval(2 * 86_400)
        moved.endsAt = moved.startsAt.addingTimeInterval(3600)
        _ = await model.refreshCalendar(using: FakeCalendarProvider(state: .authorized, events: ["evt": moved]))
        #expect(model.snapshot.calendarLinks.values.first?.startsAt == moved.startsAt)
        #expect(!model.today.visible.contains { $0.ruleID == .meetingBrief })

        // Attendance must be confirmed before it counts.
        let linkID = try #require(model.snapshot.calendarLinks.keys.first)
        try await model.confirmAttendance(linkID, happened: false)
        #expect(model.snapshot.interactions.isEmpty)
    }

    @Test func searchIsLocalAndForgetsDeletedText() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let maya = try await model.addPerson(Person(displayName: "Maya Chen", createdAt: TestDates.fixtureNow))
        let capture = try await model.addMemory("Maya is learning the cello.", people: [maya.id])
        #expect(model.search("cello").map(\.kind) == [.note])
        #expect(model.search("maya").contains { $0.kind == .person })
        try await model.deleteSource(model.sourceDeletionPreview(capture.source.id, keepConfirmed: false))
        #expect(model.search("cello").isEmpty)
    }

    @Test func contactImportBringsOnlySelectedContactsAndReviewsBirthdays() async throws {
        let env = TestEnvironment(); defer { env.directory.cleanup() }
        let model = await readyModel(env)
        let picked = [
            ImportedContact(identifier: "A", givenName: "Sam", familyName: "Rivera", phoneNumbers: [LabeledValue(value: "+1 555 010 0001")], birthday: AnnualDate(month: 11, day: 20)),
            ImportedContact(identifier: "B", givenName: "Jeff", familyName: "Park"),
        ]
        let ids = try await model.importContacts(picked)
        #expect(ids.count == 2)
        #expect(model.snapshot.people.count == 2)
        #expect(model.reviewQueue.contains { if case .date = $0 { return true } else { return false } })
        #expect(!model.today.visible.contains { $0.ruleID == .dateUpcoming }) // unconfirmed birthday
        let birthdayItem = try #require(model.reviewQueue.first)
        try await model.resolve(birthdayItem, accept: true)
        #expect(model.snapshot.importantDates.values.first?.confirmation == .confirmed)
        // Re-importing the same contact does not duplicate it.
        #expect(try await model.importContacts([picked[0]]).isEmpty)
    }
}
