import Foundation
import LTDomain

/// Normalized permission state across Apple frameworks. Every integration must show an
/// honest state; denial or revocation never breaks manual use.
public enum PermissionState: String, Sendable, Codable, Hashable {
    case notDetermined
    case denied
    case restricted
    /// iOS 18 Contacts limited access: only contacts the user chose.
    case limited
    case authorized
    /// EventKit write-only access (cannot read events).
    case writeOnly
    case unavailable

    public var canRead: Bool { self == .authorized || self == .limited }
}

// MARK: Contacts (FR1)

/// Only the fields LittleThings needs from a contact the user selected.
public struct ImportedContact: Hashable, Sendable {
    public var identifier: String
    public var givenName: String
    public var familyName: String
    public var nickname: String?
    public var phoneNumbers: [LabeledValue]
    public var emailAddresses: [LabeledValue]
    /// Month/day with optional year, if the contact card has one.
    public var birthday: AnnualDate?
    public var hasImage: Bool

    public init(identifier: String, givenName: String, familyName: String, nickname: String? = nil, phoneNumbers: [LabeledValue] = [], emailAddresses: [LabeledValue] = [], birthday: AnnualDate? = nil, hasImage: Bool = false) {
        self.identifier = identifier
        self.givenName = givenName
        self.familyName = familyName
        self.nickname = nickname
        self.phoneNumbers = phoneNumbers
        self.emailAddresses = emailAddresses
        self.birthday = birthday
        self.hasImage = hasImage
    }

    public var displayName: String {
        [givenName, familyName].filter { !$0.trimmed.isEmpty }.joined(separator: " ").nilIfBlank ?? nickname ?? "Unnamed contact"
    }
}

/// Reads contacts the user selected. The system contact picker needs no permission and
/// returns only the chosen contacts; ongoing re-reads use limited or full access and only
/// ever fetch identifiers already linked to a person.
public protocol ContactsProviding: Sendable {
    func authorizationState() -> PermissionState
    func requestAccess() async -> PermissionState
    /// Re-reads only the given identifiers. Returns nothing when access is not granted.
    func contacts(withIdentifiers identifiers: [String]) async throws -> [ImportedContact]
}

// MARK: Calendar (FR6)

public struct CalendarInfo: Hashable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var colorHex: String?

    public init(id: String, title: String, colorHex: String? = nil) {
        self.id = id
        self.title = title
        self.colorHex = colorHex
    }
}

public struct CalendarEventInfo: Hashable, Sendable {
    public var eventIdentifier: String
    public var calendarIdentifier: String
    public var title: String?
    public var startsAt: Date
    public var endsAt: Date
    public var occurrenceStart: Date
    public var isAllDay: Bool
    public var isRecurring: Bool
    public var isCancelled: Bool

    public init(eventIdentifier: String, calendarIdentifier: String, title: String?, startsAt: Date, endsAt: Date, occurrenceStart: Date? = nil, isAllDay: Bool = false, isRecurring: Bool = false, isCancelled: Bool = false) {
        self.eventIdentifier = eventIdentifier
        self.calendarIdentifier = calendarIdentifier
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.occurrenceStart = occurrenceStart ?? startsAt
        self.isAllDay = isAllDay
        self.isRecurring = isRecurring
        self.isCancelled = isCancelled
    }
}

public protocol CalendarProviding: Sendable {
    func authorizationState() -> PermissionState
    func requestFullAccess() async -> PermissionState
    func calendars() async throws -> [CalendarInfo]
    /// Events in the selected calendars only.
    func events(inCalendars calendarIDs: [String], from start: Date, to end: Date) async throws -> [CalendarEventInfo]
    /// Re-reads one occurrence. `nil` when it no longer exists.
    func event(identifier: String, occurrenceStart: Date) async throws -> CalendarEventInfo?
}

// MARK: Notifications (FR10)

public enum NotificationAuthorization: String, Sendable, Hashable {
    case notDetermined
    case denied
    case authorized
    case provisional
}

public protocol NotificationScheduling: Sendable {
    func authorization() async -> NotificationAuthorization
    func requestAuthorization() async -> NotificationAuthorization
    func pendingIdentifiers() async -> [String]
    func schedule(_ notifications: [PlannedNotification]) async throws
    func removePending(identifiers: [String]) async
    func removeAll() async
}

// MARK: Device protection

public enum BiometryKind: String, Sendable, Hashable {
    case faceID
    case touchID
    case opticID
    case none
}

public enum DeviceProtection: Sendable, Hashable {
    /// A passcode is set; biometrics may also be available.
    case available(BiometryKind)
    /// No device passcode: real data must not be stored until one is set.
    case passcodeNotSet
    case unavailable(String)

    public var canStoreRealData: Bool {
        if case .available = self { return true }
        return false
    }
}

public protocol DeviceProtectionChecking: Sendable {
    func currentProtection() -> DeviceProtection
}

// MARK: Message handoff (FR8)

/// Outcome reported by the system composer. `.sent` means the system accepted the message
/// for sending — not that it was delivered.
public enum ComposerResult: String, Sendable, Hashable {
    case sent
    case cancelled
    case failed
    case unavailable
}
