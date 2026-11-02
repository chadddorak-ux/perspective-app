import Foundation

/// Whether a piece of information has been reviewed by the user.
public enum ConfirmationState: String, Codable, Sendable, CaseIterable {
    /// The user confirmed it (or authored it).
    case confirmed
    /// Derived from a source and not yet reviewed (including scoped auto-save).
    case unconfirmed
    /// Conflicting evidence exists; must be reviewed before use.
    case disputed
}

public enum Sensitivity: String, Codable, Sendable {
    case normal
    case sensitive
}

public enum SourceKind: String, Codable, Sendable, CaseIterable {
    case manualNote
    case shareExtension
    case voiceTranscript
    case ocr
    case contactsImport
    case calendarEvent
    case fileImport
    case providerSync
}

/// Original captured material. Every extracted or imported fact points back to a source.
public struct Source: Identifiable, Hashable, Codable, Sendable {
    public var id: SourceID
    public var kind: SourceKind
    /// Provider or import format identifier, e.g. "whatsapp-chat-export".
    public var provider: String?
    public var title: String?
    public var capturedAt: Date
    /// The date the described event happened, if known. Never invented.
    public var eventDay: CalendarDay?
    public var text: String
    /// Reference to an encrypted attachment stored inside the vault.
    public var attachmentID: String?
    public var sensitivity: Sensitivity
    public var personIDs: [PersonID]
    /// Content fingerprint used to make repeated captures idempotent.
    public var fingerprint: String?
    public var isDemo: Bool
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: SourceID = SourceID(),
        kind: SourceKind,
        provider: String? = nil,
        title: String? = nil,
        capturedAt: Date,
        eventDay: CalendarDay? = nil,
        text: String,
        attachmentID: String? = nil,
        sensitivity: Sensitivity = .normal,
        personIDs: [PersonID] = [],
        fingerprint: String? = nil,
        isDemo: Bool = false,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.kind = kind
        self.provider = provider
        self.title = title
        self.capturedAt = capturedAt
        self.eventDay = eventDay
        self.text = text
        self.attachmentID = attachmentID
        self.sensitivity = sensitivity
        self.personIDs = personIDs
        self.fingerprint = fingerprint
        self.isDemo = isDemo
        self.createdAt = createdAt ?? capturedAt
        self.updatedAt = updatedAt ?? createdAt ?? capturedAt
    }
}

public enum FactCategory: String, Codable, Sendable, CaseIterable {
    case relationship
    case family
    case work
    case location
    case interest
    case preference
    case giftPreference
    case health
    case other

    /// Categories treated as sensitive by default and never used as recommendation inputs
    /// unless the user explicitly selects them.
    public var isSensitiveByDefault: Bool {
        self == .health
    }
}

/// How a fact entered the vault.
public enum FactOrigin: String, Codable, Sendable {
    /// Typed by the user directly as a fact. Stays valid independently of any source.
    case userAuthored
    /// Proposed by extraction (pattern or local model) from a source.
    case extracted
    /// Imported from a user-authorized export or connector.
    case imported
    /// Saved automatically under a source-specific auto-save setting. Still source-derived.
    case autoSaved

    public var isSourceDerived: Bool { self != .userAuthored }
}

public struct Fact: Identifiable, Hashable, Codable, Sendable {
    public var id: FactID
    public var personID: PersonID
    public var category: FactCategory
    public var label: String
    public var value: String
    public var sourceID: SourceID?
    /// Exact supporting excerpt from the source.
    public var excerpt: String?
    public var state: ConfirmationState
    public var origin: FactOrigin
    public var isSensitive: Bool
    public var validFrom: CalendarDay?
    public var validUntil: CalendarDay?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: FactID = FactID(),
        personID: PersonID,
        category: FactCategory,
        label: String,
        value: String,
        sourceID: SourceID? = nil,
        excerpt: String? = nil,
        state: ConfirmationState,
        origin: FactOrigin,
        isSensitive: Bool? = nil,
        validFrom: CalendarDay? = nil,
        validUntil: CalendarDay? = nil,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.personID = personID
        self.category = category
        self.label = label
        self.value = value
        self.sourceID = sourceID
        self.excerpt = excerpt
        self.state = state
        self.origin = origin
        self.isSensitive = isSensitive ?? category.isSensitiveByDefault
        self.validFrom = validFrom
        self.validUntil = validUntil
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    /// Source-derived facts must carry provenance.
    public var hasRequiredProvenance: Bool {
        guard origin.isSourceDerived else { return true }
        return sourceID != nil && !(excerpt ?? "").isEmpty
    }
}

/// A typed reference to the record that supports a suggestion, draft or brief.
public enum EvidenceRef: Hashable, Codable, Sendable {
    case source(SourceID)
    case fact(FactID)
    case importantDate(ImportantDateID)
    case promise(PromiseID)
    case interaction(InteractionID)
    case calendarLink(CalendarLinkID)
    case lifeEvent(LifeEventID)
    case trip(TripID)
    case gift(GiftIdeaID)
    case person(PersonID)

    public var sortKey: String {
        switch self {
        case .source(let id): return "source:\(id)"
        case .fact(let id): return "fact:\(id)"
        case .importantDate(let id): return "date:\(id)"
        case .promise(let id): return "promise:\(id)"
        case .interaction(let id): return "interaction:\(id)"
        case .calendarLink(let id): return "calendar:\(id)"
        case .lifeEvent(let id): return "life:\(id)"
        case .trip(let id): return "trip:\(id)"
        case .gift(let id): return "gift:\(id)"
        case .person(let id): return "person:\(id)"
        }
    }
}
