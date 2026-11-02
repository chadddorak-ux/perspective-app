import Foundation
import LTDomain
import LTVault

/// A clock that returns a fixed, settable instant.
public final class TestClock: WallClock, @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    public init(_ now: Date) { current = now }

    public var now: Date {
        lock.lock(); defer { lock.unlock() }
        return current
    }

    public func set(_ date: Date) {
        lock.lock(); current = date; lock.unlock()
    }

    public func advance(by seconds: TimeInterval) {
        lock.lock(); current = current.addingTimeInterval(seconds); lock.unlock()
    }
}

/// In-memory stand-in for the Keychain-backed key store.
public final class InMemoryVaultKeyStore: VaultKeyStore, @unchecked Sendable {
    private let lock = NSLock()
    private var key: VaultKeyMaterial?
    public var deviceProtectionAvailable: Bool
    public var authenticationSucceeds: Bool
    public private(set) var readCount = 0

    public init(deviceProtectionAvailable: Bool = true, authenticationSucceeds: Bool = true) {
        self.deviceProtectionAvailable = deviceProtectionAvailable
        self.authenticationSucceeds = authenticationSucceeds
    }

    public func hasKey() throws -> Bool {
        lock.lock(); defer { lock.unlock() }
        return key != nil
    }

    public func createKey() throws -> VaultKeyMaterial {
        lock.lock(); defer { lock.unlock() }
        guard deviceProtectionAvailable else { throw VaultError.deviceProtectionUnavailable }
        let new = VaultKeyMaterial.generate()
        key = new
        return new
    }

    public func readKey(reason: String) async throws -> VaultKeyMaterial {
        try lock.withLock {
            readCount += 1
            guard authenticationSucceeds else { throw TestError.authenticationFailed }
            guard let key else { throw VaultError.invalidKey }
            return key
        }
    }

    public func deleteKey() throws {
        lock.lock(); key = nil; lock.unlock()
    }
}

public enum TestError: Error, Equatable {
    case authenticationFailed
    case unexpected(String)
}

/// A unique temporary directory removed on `cleanup()`.
public struct TemporaryDirectory: Sendable {
    public let url: URL

    public init() {
        url = FileManager.default.temporaryDirectory
            .appendingPathComponent("littlethings-tests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    }

    public func cleanup() {
        try? FileManager.default.removeItem(at: url)
    }
}

/// Deterministic UUIDs for fixtures.
public func fixedUUID(_ n: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-4000-8000-%012d", n))!
}

public enum TestDates {
    public static let newYork = TimeZone(identifier: "America/New_York")!
    public static let utc = TimeZone(identifier: "UTC")!

    /// Build an instant from local wall-clock components in a time zone.
    public static func instant(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 12, _ minute: Int = 0, in timeZone: TimeZone = newYork) -> Date {
        CalendarDay(year, month, day).date(at: TimeOfDay(hour: hour, minute: minute), in: timeZone)
    }

    /// Fixture "now": Monday 2026-11-02 09:00 in New York.
    public static let fixtureNow = instant(2026, 11, 2, 9, 0)
}

/// Synthetic people described in PRD section 11. No real people or data.
public struct SyntheticFixtures {
    public let snapshot: VaultSnapshot
    public let sam: PersonID
    public let jeff: PersonID
    public let maya: PersonID
    public let alex: PersonID
    public let rachel: PersonID
    public let chrisLee: PersonID
    public let chrisLi: PersonID
    public let samNote: SourceID
    public let samJobFact: FactID
    public let samNewJob: LifeEventID
    public let jeffCall: InteractionID
    public let mayaBirthday: ImportantDateID
    public let alexNote: SourceID
    public let alexPromise: PromiseID
    public let rachelDate: ImportantDateID

    public init(now: Date = TestDates.fixtureNow, isDemo: Bool = false) {
        func id<T>(_ n: Int) -> EntityID<T> { EntityID<T>(fixedUUID(n)) }
        let created = now.addingTimeInterval(-60 * 86_400)
        var s = VaultSnapshot()

        sam = id(1); jeff = id(2); maya = id(3); alex = id(4); rachel = id(5); chrisLee = id(6); chrisLi = id(7)
        samNote = id(101); samJobFact = id(201); samNewJob = id(301); jeffCall = id(401)
        mayaBirthday = id(501); alexNote = id(102); alexPromise = id(601); rachelDate = id(502)

        let people = [
            Person(id: sam, displayName: "Sam Rivera", relationshipLabel: "Friend", circles: ["College"], phoneNumbers: [LabeledValue(label: "mobile", value: "+1 (555) 010-0001")], city: "Chicago", isDemo: isDemo, createdAt: created),
            Person(id: jeff, displayName: "Jeff Park", relationshipLabel: "Friend", phoneNumbers: [LabeledValue(value: "555-010-0002")], city: "Seattle", reminderPreferences: ReminderPreferences(cadenceDays: 21), isDemo: isDemo, createdAt: created),
            Person(id: maya, displayName: "Maya Chen", relationshipLabel: "Cousin", circles: ["Family"], isDemo: isDemo, createdAt: created),
            Person(id: alex, displayName: "Alex Morgan", relationshipLabel: "Friend", emailAddresses: [LabeledValue(value: "alex@example.com")], city: "Chicago", isDemo: isDemo, createdAt: created),
            Person(id: rachel, displayName: "Rachel Adams", relationshipLabel: "Friend", isDemo: isDemo, createdAt: created),
            Person(id: chrisLee, displayName: "Chris Lee", phoneNumbers: [LabeledValue(value: "+1 555 010 0101")], isDemo: isDemo, createdAt: created),
            Person(id: chrisLi, displayName: "Chris Li", phoneNumbers: [LabeledValue(value: "+1 555 010 0199")], isDemo: isDemo, createdAt: created),
        ]
        for p in people { s.people[p.id] = p }

        let samCaptured = TestDates.instant(2026, 10, 20, 18)
        s.sources[samNote] = Source(
            id: samNote, kind: .manualNote, capturedAt: samCaptured, eventDay: CalendarDay(2026, 10, 20),
            text: "Sam got the team lead job at Northwind. He starts November 2. He was excited about managing a team.",
            personIDs: [sam], isDemo: isDemo
        )
        s.facts[samJobFact] = Fact(
            id: samJobFact, personID: sam, category: .work, label: "Feeling about new role",
            value: "Excited about managing a team", sourceID: samNote,
            excerpt: "He was excited about managing a team.", state: .confirmed, origin: .extracted, createdAt: samCaptured
        )
        s.lifeEvents[samNewJob] = LifeEvent(
            id: samNewJob, personID: sam, category: .newJob, summary: "Starts new job as team lead at Northwind",
            sourceIDs: [samNote], excerpt: "He starts November 2.", eventDay: CalendarDay(2026, 11, 2),
            capturedAt: samCaptured, confirmation: .confirmed, createdAt: samCaptured
        )

        s.interactions[jeffCall] = Interaction(
            id: jeffCall, personIDs: [jeff], kind: .call, occurredAt: TestDates.instant(2026, 10, 8, 19),
            confirmation: .userConfirmed, createdAt: TestDates.instant(2026, 10, 8, 20)
        )

        s.importantDates[mayaBirthday] = ImportantDate(
            id: mayaBirthday, personID: maya, category: .birthday,
            schedule: .annual(AnnualDate(month: 11, day: 10)!), createdAt: created
        )

        let alexCaptured = TestDates.instant(2026, 10, 30, 21)
        s.sources[alexNote] = Source(
            id: alexNote, kind: .manualNote, capturedAt: alexCaptured,
            text: "Alex's daughter is Maya. Her recital is December 12. I promised to send him the photographer's number.",
            personIDs: [alex], isDemo: isDemo
        )
        s.promises[alexPromise] = Promise(
            id: alexPromise, personIDs: [alex], description: "Send Alex the photographer's number",
            due: .day(CalendarDay(2026, 11, 3)), sourceID: alexNote,
            excerpt: "I promised to send him the photographer's number.", createdAt: alexCaptured
        )

        s.importantDates[rachelDate] = ImportantDate(
            id: rachelDate, personID: rachel, category: .careful, label: "Anniversary of her father's passing",
            schedule: .annual(AnnualDate(month: 11, day: 4)!), reminderOffsetsDays: [3, 0], remindersEnabled: true, createdAt: created
        )
        snapshot = s
    }
}
