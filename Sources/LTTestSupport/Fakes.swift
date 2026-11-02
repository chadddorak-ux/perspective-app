import Foundation
import LTAppCore
import LTDomain
import LTIntegrations
import LTIntelligence
import LTVault

public final class FakeNotificationScheduler: NotificationScheduling, @unchecked Sendable {
    private let lock = NSLock()
    private var _authorization: NotificationAuthorization
    private var _pending: [String: PlannedNotification] = [:]
    private var _requests = 0
    public var grantOnRequest: Bool

    public init(authorization: NotificationAuthorization = .notDetermined, grantOnRequest: Bool = true) {
        _authorization = authorization
        self.grantOnRequest = grantOnRequest
    }

    public var pending: [PlannedNotification] { lock.withLock { Array(_pending.values) } }
    public var requestCount: Int { lock.withLock { _requests } }

    public func authorization() async -> NotificationAuthorization { lock.withLock { _authorization } }

    public func requestAuthorization() async -> NotificationAuthorization {
        lock.withLock {
            _requests += 1
            _authorization = grantOnRequest ? .authorized : .denied
            return _authorization
        }
    }

    public func setAuthorization(_ value: NotificationAuthorization) { lock.withLock { _authorization = value } }

    public func pendingIdentifiers() async -> [String] { lock.withLock { Array(_pending.keys) } }

    public func schedule(_ notifications: [PlannedNotification]) async throws {
        lock.withLock { for n in notifications { _pending[n.identifier] = n } }
    }

    public func removePending(identifiers: [String]) async {
        lock.withLock { for id in identifiers { _pending[id] = nil } }
    }

    public func removeAll() async { lock.withLock { _pending = [:] } }
}

public final class InMemorySecrets: SecretStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var values: [SecretName: Data] = [:]

    public init() {}

    public func data(for name: SecretName) throws -> Data? { lock.withLock { values[name] } }
    public func set(_ data: Data, for name: SecretName) throws { lock.withLock { values[name] = data } }
    public func delete(_ name: SecretName) throws { lock.withLock { values[name] = nil } }
    public var isEmpty: Bool { lock.withLock { values.isEmpty } }
}

public struct FakeDeviceProtection: DeviceProtectionChecking {
    public var protection: DeviceProtection
    public init(_ protection: DeviceProtection = .available(.faceID)) { self.protection = protection }
    public func currentProtection() -> DeviceProtection { protection }
}

/// Stands in for the on-device model. Returns canned (possibly malicious) output.
public struct FakeLocalModel: LocalExtractionModel {
    public var available: LocalModelAvailability
    public var output: RawExtraction

    public init(available: LocalModelAvailability = .available, output: RawExtraction) {
        self.available = available
        self.output = output
    }

    public func availability() -> LocalModelAvailability { available }
    public func extract(_ request: ExtractionRequest) async throws -> RawExtraction { output }
}

public final class FakeCalendarProvider: CalendarProviding, @unchecked Sendable {
    public var state: PermissionState
    public var events: [String: CalendarEventInfo]

    public init(state: PermissionState, events: [String: CalendarEventInfo] = [:]) {
        self.state = state
        self.events = events
    }

    public func authorizationState() -> PermissionState { state }
    public func requestFullAccess() async -> PermissionState { state }
    public func calendars() async throws -> [CalendarInfo] { [CalendarInfo(id: "cal", title: "Personal")] }
    public func events(inCalendars calendarIDs: [String], from start: Date, to end: Date) async throws -> [CalendarEventInfo] {
        Array(events.values).filter { calendarIDs.contains($0.calendarIdentifier) && $0.startsAt >= start && $0.startsAt <= end }
    }
    public func event(identifier: String, occurrenceStart: Date) async throws -> CalendarEventInfo? { events[identifier] }
}

/// A complete test environment rooted in a temporary directory.
public struct TestEnvironment {
    public let directory: TemporaryDirectory
    public let keyStore: InMemoryVaultKeyStore
    public let secrets: InMemorySecrets
    public let notifications: FakeNotificationScheduler
    public let clock: TestClock
    public var environment: AppEnvironment

    public init(now: Date = TestDates.fixtureNow, protection: DeviceProtection = .available(.faceID), localModel: (any LocalExtractionModel)? = nil, directory: TemporaryDirectory = TemporaryDirectory(), keyStore: InMemoryVaultKeyStore = InMemoryVaultKeyStore(), secrets: InMemorySecrets = InMemorySecrets(), notifications: FakeNotificationScheduler = FakeNotificationScheduler()) {
        self.directory = directory
        self.keyStore = keyStore
        self.secrets = secrets
        self.notifications = notifications
        self.clock = TestClock(now)
        let inbox = directory.url.appendingPathComponent("ShareInbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
        environment = AppEnvironment(
            vaultDirectory: directory.url.appendingPathComponent("Vault", isDirectory: true),
            keyStore: keyStore,
            secrets: secrets,
            deviceProtection: FakeDeviceProtection(protection),
            clock: clock,
            currentTimeZone: { TestDates.newYork },
            notifications: notifications,
            localModel: localModel,
            shareInboxDirectory: inbox,
            appVersion: "test"
        )
    }
}
