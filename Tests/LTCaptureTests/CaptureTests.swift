import Foundation
import Testing
@testable import LTCapture
import LTCryptoSupport
import LTDomain
import LTSuggestions
import LTTestSupport

@Suite("Share inbox and capture pipeline (FR12)")
struct ShareInboxTests {
    let now = TestDates.fixtureNow

    @Test func sealedItemsOpenOnlyWithTheAppKey() throws {
        let appKey = Curve25519.KeyAgreement.PrivateKey()
        let item = InboxItem(receivedAt: now, text: "Sam starts at Northwind on Monday!", url: URL(string: "https://example.com/post/1"))
        let sealed = try ShareInbox.seal(item, to: appKey.publicKey)
        #expect(sealed.range(of: Data("Northwind".utf8)) == nil)
        #expect(try ShareInbox.open(sealed, with: appKey) == item)
        #expect(throws: (any Error).self) { try ShareInbox.open(sealed, with: Curve25519.KeyAgreement.PrivateKey()) }
        var tampered = sealed
        tampered[8] ^= 0xFF
        #expect(throws: (any Error).self) { try ShareInbox.open(tampered, with: appKey) }
        #expect(throws: ShareInboxError.malformed) { try ShareInbox.open(Data("nope".utf8), with: appKey) }
        #expect(ShareInbox.fileName(for: item).hasPrefix("item-") && !ShareInbox.fileName(for: item).contains("Sam"))
    }

    @Test func textShareIsCapturedOnceAndIdempotent() {
        var snapshot = SyntheticFixtures().snapshot
        let item = InboxItem(receivedAt: now, text: "  Maya got into the conservatory!  ")
        guard case .captured(let source, let record) = CapturePipeline.capture(item, personIDs: [], in: snapshot) else {
            Issue.record("expected capture"); return
        }
        #expect(source.kind == .shareExtension)
        #expect(source.text == "Maya got into the conservatory!")
        #expect(record.sourceID == source.id)
        snapshot.apply([.upsert(.source(source)), .upsert(.captureRecord(record))])
        let again = InboxItem(receivedAt: now.addingTimeInterval(60), text: "Maya got into the   conservatory!")
        #expect(CapturePipeline.capture(again, personIDs: [], in: snapshot) == .duplicate(existingSource: source.id))
        #expect(CapturePipeline.capture(InboxItem(receivedAt: now, text: "   "), personIDs: [], in: snapshot) == .empty)
    }

    @Test func recognizedExportsRouteToImportPreview() {
        let chat = Data("[10/1/26, 9:15:02 AM] Jeff Park: hey!\n".utf8)
        #expect(CapturePipeline.capture(InboxItem(receivedAt: now, fileName: "WhatsApp Chat - Jeff Park.txt", fileData: chat), personIDs: [], in: VaultSnapshot()) == .importCandidate(.whatsAppChat))
        let csv = Data("First Name,Last Name,URL,Email Address,Company,Position,Connected On\nSam,Rivera,,,Northwind,Team Lead,02 Nov 2026\n".utf8)
        #expect(CapturePipeline.capture(InboxItem(receivedAt: now, fileName: "Connections.csv", fileData: csv), personIDs: [], in: VaultSnapshot()) == .importCandidate(.linkedInConnections))
    }
}

@Suite("User-authorized imports (FR12, FR13, FR14)")
struct ImportTests {
    let now = TestDates.fixtureNow
    let tz = TestDates.newYork

    static let iosExport = """
    [8/20/26, 9:15:02\u{202F}AM] Jeff Park: \u{200E}Messages and calls are end-to-end encrypted.
    [8/20/26, 9:15:02\u{202F}AM] Jeff Park: Are we still on for Saturday?
    [8/20/26, 9:20:11\u{202F}AM] Me Myself: Yes! See you at 10.
    Bring the map.
    [8/20/26, 7:01:00\u{202F}PM] Jeff Park: \u{200E}image omitted
    """

    @Test func parsesIOSFormatWithNarrowSpacesAndContinuationLines() {
        let chat = WhatsAppChatParser.parse(ImportTests.iosExport, timeZone: tz)
        #expect(chat.participants == ["Jeff Park", "Me Myself"])
        // The encryption banner is a system notice, not conversation.
        #expect(chat.messages.count == 3)
        #expect(chat.messages[1].text == "Yes! See you at 10.\nBring the map.")
        #expect(chat.messages[2].text == "") // media placeholder: activity, but no text
        #expect(chat.messages[2].timestamp == TestDates.instant(2026, 8, 20, 19, 1))
        #expect(!chat.dayFirst)
        #expect(!chat.dateOrderAmbiguous) // 20 > 12 proves month-first
    }

    @Test func parsesAndroidDayFirstFormat() {
        let text = "13/09/2026, 21:41 - Jeff Park: Back from the trip\n14/09/2026, 08:05 - Me: Welcome back!\n"
        let chat = WhatsAppChatParser.parse(text, timeZone: tz)
        #expect(chat.dayFirst)
        #expect(!chat.dateOrderAmbiguous)
        #expect(chat.messages.first?.timestamp == TestDates.instant(2026, 9, 13, 21, 41))
    }

    @Test func ambiguousDateOrderIsFlagged() {
        let chat = WhatsAppChatParser.parse("[3/4/26, 10:00:00 AM] Jeff Park: hi\n[4/3/26, 10:00:00 AM] Me: hi", timeZone: tz)
        #expect(chat.dateOrderAmbiguous)
        let plan = ImportPlanner.planWhatsApp(chat, selfName: "Me", mapping: ["Jeff Park": PersonID()], in: VaultSnapshot(), importedAt: now, timeZone: tz)
        #expect(plan.preview.warnings.contains { $0.contains("day-first or month-first") })
    }

    /// Chat began in June; ten active days in the eight weeks before Oct 10, then silence.
    /// Coverage starts at the first exported message, so the history must predate the baseline.
    func regularChat() -> String {
        var lines: [String] = ["[6/1/26, 10:00:00 AM] Jeff Park: Hi, it's Jeff from the climbing gym"]
        for offset in stride(from: 45, through: 0, by: -5) {
            let day = CalendarDay(2026, 10, 10).adding(days: -offset)
            lines.append("[\(day.month)/\(day.day)/26, 12:00:00 PM] Jeff Park: message \(offset)")
            lines.append("[\(day.month)/\(day.day)/26, 8:30:00 PM] Me: reply \(offset)")
        }
        return lines.joined(separator: "\n")
    }

    @Test func whatsAppImportFeedsRhythmAndIsIdempotent() throws {
        var snapshot = VaultSnapshot()
        let jeff = Person(displayName: "Jeff Park", reminderPreferences: ReminderPreferences(observedPatternEnabled: true), createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[jeff.id] = jeff
        let chat = WhatsAppChatParser.parse(regularChat(), timeZone: tz)
        #expect(ImportPlanner.suggestedMapping(for: chat.participants, people: [jeff]) == ["Jeff Park": jeff.id])

        let plan = ImportPlanner.planWhatsApp(chat, selfName: "Me", mapping: ["Jeff Park": jeff.id], in: snapshot, importedAt: now, timeZone: tz)
        #expect(plan.preview.newRecords == 12) // 11 active days + transcript
        #expect(plan.preview.duplicateRecords == 0)
        #expect(plan.preview.estimatedStorageBytes > 0)
        snapshot.apply(plan.changes)
        #expect(snapshot.referentialProblems().isEmpty)
        #expect(snapshot.interactions.count == 11)
        #expect(snapshot.interactions.values.allSatisfy { $0.confirmation == .sourceObserved && !$0.isGroup })
        let connection = try #require(snapshot.connections.values.first)
        #expect(connection.isManualImport)

        // Rhythm now has honest coverage from the export.
        let context = EvaluationContext(now: now, timeZone: tz)
        guard case .lull(let finding) = RhythmAnalyzer.analyze(personID: jeff.id, in: snapshot, context: context, parameters: RhythmParameters()) else {
            Issue.record("expected a lull finding from imported history"); return
        }
        #expect(finding.activeDaysInBaseline == 10)

        // Re-importing the same export adds nothing new.
        let again = ImportPlanner.planWhatsApp(chat, selfName: "Me", mapping: ["Jeff Park": jeff.id], in: snapshot, importedAt: now.addingTimeInterval(60), timeZone: tz)
        #expect(again.preview.newRecords == 0)
        snapshot.apply(again.changes)
        #expect(snapshot.interactions.count == 11)
        #expect(snapshot.sources.count == 1)
        #expect(snapshot.connections.count == 1)
    }

    @Test func groupChatsAreMarkedAndUnmappedPeopleSkipped() {
        let text = "[10/1/26, 9:00:00 AM] Jeff Park: hi all\n[10/1/26, 9:01:00 AM] Sam Rivera: hey\n[10/1/26, 9:02:00 AM] Me: hello"
        let chat = WhatsAppChatParser.parse(text, timeZone: tz)
        #expect(chat.isGroup)
        let jeff = PersonID()
        let plan = ImportPlanner.planWhatsApp(chat, selfName: "Me", mapping: ["Jeff Park": jeff], in: VaultSnapshot(), importedAt: now, timeZone: tz)
        #expect(plan.preview.warnings.contains { $0.contains("group chat") })
        #expect(plan.preview.warnings.contains { $0.contains("aren't matched") })
        let interactions = plan.changes.compactMap { change -> Interaction? in
            if case .upsert(.interaction(let i)) = change { return i }
            return nil
        }
        #expect(interactions.allSatisfy { $0.isGroup && $0.personIDs == [jeff] })
    }

    static let linkedIn = """
    Notes:
    "When exporting your connection data, you may notice that some of the email addresses are missing."

    First Name,Last Name,URL,Email Address,Company,Position,Connected On
    Sam,Rivera,https://www.linkedin.com/in/example-sam,,"Northwind, Inc.",Engineer,12 Mar 2021
    Jordan,Blake,https://www.linkedin.com/in/example-jordan,,Contoso,Designer,01 Jan 2020
    """

    @Test func linkedInStoresOnlyMappedRowsAndDetectsRoleChanges() throws {
        let rows = LinkedInConnectionsParser.parse(ImportTests.linkedIn)
        #expect(rows.count == 2)
        #expect(rows[0].company == "Northwind, Inc.")
        var snapshot = VaultSnapshot()
        let sam = Person(displayName: "Sam Rivera", createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[sam.id] = sam
        let mapping = ImportPlanner.suggestedMapping(for: rows.map(\.fullName), people: [sam])
        #expect(mapping == ["Sam Rivera": sam.id])

        let first = ImportPlanner.planLinkedIn(rows, mapping: mapping, in: snapshot, importedAt: TestDates.instant(2026, 10, 1))
        snapshot.apply(first.changes)
        let source = try #require(snapshot.sources.values.first)
        #expect(!source.text.contains("Jordan")) // unmapped network rows are never stored
        #expect(snapshot.lifeEvents.isEmpty)
        #expect(ImportPlanner.planLinkedIn(rows, mapping: mapping, in: snapshot, importedAt: now).changes.isEmpty)

        var changed = rows
        changed[0].position = "Team Lead"
        let second = ImportPlanner.planLinkedIn(changed, mapping: mapping, in: snapshot, importedAt: now)
        snapshot.apply(second.changes)
        let event = try #require(snapshot.lifeEvents.values.first)
        #expect(event.category == .newJob)
        #expect(event.confirmation == .unconfirmed)
        #expect(event.eventDay == nil) // the export has no start date; none is invented
        #expect(snapshot.referentialProblems().isEmpty)
        // Undated, unconfirmed updates never become Today cards on their own.
        let cards = SuggestionEngine().evaluate(snapshot, context: EvaluationContext(now: now, timeZone: tz))
        #expect(!(cards.visible + cards.more).contains { $0.ruleID == .lifeUpdate })
    }

    @Test func revokingAnImportStopsCaptureAndCanDeleteCopies() {
        var snapshot = VaultSnapshot()
        let jeff = Person(displayName: "Jeff Park", reminderPreferences: ReminderPreferences(observedPatternEnabled: true), createdAt: TestDates.instant(2026, 1, 1))
        snapshot.people[jeff.id] = jeff
        let chat = WhatsAppChatParser.parse(regularChat(), timeZone: tz)
        snapshot.apply(ImportPlanner.planWhatsApp(chat, selfName: "Me", mapping: ["Jeff Park": jeff.id], in: snapshot, importedAt: now, timeZone: tz).changes)
        let connectionID = snapshot.connections.keys.first!

        var kept = snapshot
        kept.apply(ImportPlanner.planRevocation(of: connectionID, deleteImported: false, in: kept, now: now))
        #expect(kept.connections[connectionID]?.state == .revoked)
        #expect(RhythmAnalyzer.analyze(personID: jeff.id, in: kept, context: EvaluationContext(now: now, timeZone: tz), parameters: RhythmParameters()) != .noLull)
        if case .lull = RhythmAnalyzer.analyze(personID: jeff.id, in: kept, context: EvaluationContext(now: now, timeZone: tz), parameters: RhythmParameters()) {
            Issue.record("revoked source must pause rhythm")
        }

        snapshot.apply(ImportPlanner.planRevocation(of: connectionID, deleteImported: true, in: snapshot, now: now))
        #expect(snapshot.interactions.isEmpty)
        #expect(snapshot.sources.isEmpty)
        #expect(snapshot.connections.isEmpty)
        #expect(snapshot.captureRecords.isEmpty)
        #expect(snapshot.referentialProblems().isEmpty)
    }

    @Test func csvHandlesQuotesAndEscapes() {
        #expect(CSV.parse("a,\"b, c\",\"d \"\"e\"\"\"\n1,2,3") == [["a", "b, c", "d \"e\""], ["1", "2", "3"]])
    }
}
