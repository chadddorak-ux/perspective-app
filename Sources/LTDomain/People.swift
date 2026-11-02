import Foundation

public struct LabeledValue: Hashable, Codable, Sendable {
    public var label: String?
    public var value: String

    public init(label: String? = nil, value: String) {
        self.label = label
        self.value = value
    }
}

/// A device-local reference to a system contact. Contact identifiers are not stable across
/// devices, so they are only used to re-read the contact the user selected on this device.
public struct ContactReference: Hashable, Codable, Sendable {
    public var identifier: String
    public var linkedAt: Date

    public init(identifier: String, linkedAt: Date) {
        self.identifier = identifier
        self.linkedAt = linkedAt
    }
}

public struct ReminderPreferences: Hashable, Codable, Sendable {
    /// Pausing a person suppresses every suggestion and notification about them.
    public var isPaused: Bool
    /// Optional user-chosen check-in cadence in days.
    public var cadenceDays: Int?
    /// Whether observed-pattern (FR14) suggestions are enabled for this person.
    public var observedPatternEnabled: Bool

    public init(isPaused: Bool = false, cadenceDays: Int? = nil, observedPatternEnabled: Bool = false) {
        self.isPaused = isPaused
        self.cadenceDays = cadenceDays
        self.observedPatternEnabled = observedPatternEnabled
    }
}

public struct Person: Identifiable, Hashable, Codable, Sendable {
    public var id: PersonID
    public var displayName: String
    public var preferredName: String?
    public var relationshipLabel: String?
    public var circles: [String]
    public var phoneNumbers: [LabeledValue]
    public var emailAddresses: [LabeledValue]
    public var city: String?
    public var timeZoneIdentifier: String?
    /// User-entered only. Never inferred from social or imported content.
    public var address: String?
    public var communicationPreferences: String?
    public var notes: String?
    /// Things to avoid or handle with care (per-person boundary).
    public var boundaries: String?
    public var contactReference: ContactReference?
    public var isFavorite: Bool
    public var isArchived: Bool
    public var reminderPreferences: ReminderPreferences
    /// Synthetic demo data is flagged and never mixed with real records.
    public var isDemo: Bool
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: PersonID = PersonID(),
        displayName: String,
        preferredName: String? = nil,
        relationshipLabel: String? = nil,
        circles: [String] = [],
        phoneNumbers: [LabeledValue] = [],
        emailAddresses: [LabeledValue] = [],
        city: String? = nil,
        timeZoneIdentifier: String? = nil,
        address: String? = nil,
        communicationPreferences: String? = nil,
        notes: String? = nil,
        boundaries: String? = nil,
        contactReference: ContactReference? = nil,
        isFavorite: Bool = false,
        isArchived: Bool = false,
        reminderPreferences: ReminderPreferences = ReminderPreferences(),
        isDemo: Bool = false,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.preferredName = preferredName
        self.relationshipLabel = relationshipLabel
        self.circles = circles
        self.phoneNumbers = phoneNumbers
        self.emailAddresses = emailAddresses
        self.city = city
        self.timeZoneIdentifier = timeZoneIdentifier
        self.address = address
        self.communicationPreferences = communicationPreferences
        self.notes = notes
        self.boundaries = boundaries
        self.contactReference = contactReference
        self.isFavorite = isFavorite
        self.isArchived = isArchived
        self.reminderPreferences = reminderPreferences
        self.isDemo = isDemo
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    /// The name to use in cards and drafts.
    public var name: String {
        if let preferred = preferredName?.trimmed, !preferred.isEmpty { return preferred }
        return displayName
    }

    /// Initials used when no contact image is available.
    public var initials: String {
        let words = displayName.split(whereSeparator: { $0.isWhitespace }).prefix(2)
        let letters = words.compactMap { $0.first }.map { String($0).uppercased() }
        return letters.isEmpty ? "?" : letters.joined()
    }

    /// Whether rules may generate suggestions or notifications about this person.
    public var isEligibleForSuggestions: Bool {
        !isArchived && !reminderPreferences.isPaused
    }
}

extension String {
    public var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
    public var nilIfBlank: String? { trimmed.isEmpty ? nil : self }
}
