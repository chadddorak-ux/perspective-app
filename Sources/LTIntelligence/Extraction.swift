import Foundation
import LTDomain

// MARK: - Untrusted model output

/// Structured output from a local model or the pattern extractor. Treated as untrusted
/// data: nothing here is saved, scheduled or acted on until `ExtractionValidator` grounds it
/// in the source text and the user reviews it.
public struct RawExtraction: Codable, Sendable, Hashable {
    public var facts: [RawFact]
    public var dates: [RawDate]
    public var promises: [RawPromise]
    public var lifeEvents: [RawLifeEvent]

    public init(facts: [RawFact] = [], dates: [RawDate] = [], promises: [RawPromise] = [], lifeEvents: [RawLifeEvent] = []) {
        self.facts = facts
        self.dates = dates
        self.promises = promises
        self.lifeEvents = lifeEvents
    }
}

public struct RawFact: Codable, Sendable, Hashable {
    public var personName: String?
    public var category: String
    public var label: String
    public var value: String
    public var excerpt: String

    public init(personName: String?, category: String, label: String, value: String, excerpt: String) {
        self.personName = personName
        self.category = category
        self.label = label
        self.value = value
        self.excerpt = excerpt
    }
}

public struct RawDate: Codable, Sendable, Hashable {
    public var personName: String?
    public var label: String
    /// "birthday", "anniversary", "milestone", "custom".
    public var kind: String
    /// The date words exactly as written in the note.
    public var dateText: String
    public var excerpt: String

    public init(personName: String?, label: String, kind: String, dateText: String, excerpt: String) {
        self.personName = personName
        self.label = label
        self.kind = kind
        self.dateText = dateText
        self.excerpt = excerpt
    }
}

public struct RawPromise: Codable, Sendable, Hashable {
    public var personName: String?
    public var description: String
    /// "me", "them".
    public var owner: String
    /// "commitment" or "followUp".
    public var kind: String
    public var dueText: String?
    public var excerpt: String

    public init(personName: String?, description: String, owner: String, kind: String = "commitment", dueText: String? = nil, excerpt: String) {
        self.personName = personName
        self.description = description
        self.owner = owner
        self.kind = kind
        self.dueText = dueText
        self.excerpt = excerpt
    }
}

public struct RawLifeEvent: Codable, Sendable, Hashable {
    public var personName: String?
    public var category: String
    public var summary: String
    public var dateText: String?
    public var excerpt: String

    public init(personName: String?, category: String, summary: String, dateText: String? = nil, excerpt: String) {
        self.personName = personName
        self.category = category
        self.summary = summary
        self.dateText = dateText
        self.excerpt = excerpt
    }
}

// MARK: - Model boundary

public enum LocalModelUnavailableReason: String, Sendable, Hashable {
    case deviceNotEligible
    case appleIntelligenceNotEnabled
    case modelNotReady
    case unsupportedLanguage
    case operatingSystemTooOld
    case other
}

public enum LocalModelAvailability: Sendable, Hashable {
    case available
    case unavailable(LocalModelUnavailableReason)

    public var isAvailable: Bool { self == .available }

    public var userFacingText: String {
        switch self {
        case .available: return "On-device AI is available. Notes are processed on this iPhone."
        case .unavailable(.deviceNotEligible): return "This iPhone doesn't support on-device AI. Manual entry and suggestions from your wording still work."
        case .unavailable(.appleIntelligenceNotEnabled): return "Turn on Apple Intelligence in Settings to use on-device extraction. Nothing is sent to a cloud model."
        case .unavailable(.modelNotReady): return "The on-device model is still downloading. Try again later."
        case .unavailable(.unsupportedLanguage): return "On-device AI doesn't support this language yet."
        case .unavailable(.operatingSystemTooOld): return "On-device AI needs a newer version of iOS."
        case .unavailable(.other): return "On-device AI is unavailable right now."
        }
    }
}

/// The only people and text a model may see for one request: the selected source and the
/// people it is linked to. No other vault content is supplied.
public struct ExtractionRequest: Sendable, Hashable {
    public var sourceText: String
    public var captureDay: CalendarDay
    public var people: [PersonHint]

    public init(sourceText: String, captureDay: CalendarDay, people: [PersonHint]) {
        self.sourceText = sourceText
        self.captureDay = captureDay
        self.people = people
    }
}

public struct PersonHint: Sendable, Hashable {
    public var id: PersonID
    public var names: [String]

    public init(id: PersonID, names: [String]) {
        self.id = id
        self.names = names
    }

    public init(person: Person) {
        self.id = person.id
        self.names = [person.displayName, person.preferredName].compactMap { $0?.nilIfBlank }
    }
}

/// An on-device extraction model (Apple Foundation Models in the app). Implementations must
/// never call a remote service. There is no cloud fallback.
public protocol LocalExtractionModel: Sendable {
    func availability() -> LocalModelAvailability
    func extract(_ request: ExtractionRequest) async throws -> RawExtraction
}

// MARK: - Validated proposals

public enum IdentityResolution: Hashable, Sendable {
    case resolved(PersonID)
    /// Several people could match; the user must choose.
    case ambiguous([PersonID])
    /// No supplied person matches; the user must choose or skip.
    case unresolved(String?)

    public var personID: PersonID? {
        if case .resolved(let id) = self { return id }
        return nil
    }
}

public struct ProposedFact: Hashable, Sendable {
    public var identity: IdentityResolution
    public var category: FactCategory
    public var label: String
    public var value: String
    public var excerpt: String
    public var isSensitive: Bool
}

public struct ProposedDate: Hashable, Sendable {
    public var identity: IdentityResolution
    public var category: DateCategory
    public var label: String
    public var match: DateMatch
    public var excerpt: String
    public var isSensitive: Bool

    public var schedule: DateSchedule {
        switch category {
        case .birthday, .anniversary, .customAnnual, .careful:
            return .annual(AnnualDate(month: match.month, day: match.day, year: category == .birthday ? match.statedYear : nil) ?? AnnualDate(month: match.month, day: match.day)!)
        case .milestone:
            return .once(match.resolvedDay)
        }
    }
}

public struct ProposedPromise: Hashable, Sendable {
    public var identity: IdentityResolution
    public var kind: PromiseKind
    public var ownerIsMe: Bool
    public var description: String
    public var due: DateMatch?
    public var excerpt: String
}

public struct ProposedLifeEvent: Hashable, Sendable {
    public var identity: IdentityResolution
    public var category: LifeEventCategory
    public var summary: String
    public var eventDate: DateMatch?
    public var excerpt: String
    public var explicitness: Explicitness
    public var isSensitive: Bool
}

public struct Rejection: Hashable, Sendable {
    public var item: String
    public var reason: String
}

/// Grounded proposals ready for review. Facts and actions are kept separate, as the review
/// screen shows them separately.
public struct ExtractionProposal: Hashable, Sendable {
    public var facts: [ProposedFact] = []
    public var dates: [ProposedDate] = []
    public var promises: [ProposedPromise] = []
    public var lifeEvents: [ProposedLifeEvent] = []
    public var rejected: [Rejection] = []

    public var isEmpty: Bool { facts.isEmpty && dates.isEmpty && promises.isEmpty && lifeEvents.isEmpty }
}
