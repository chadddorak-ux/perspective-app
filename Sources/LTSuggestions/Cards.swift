import Foundation
import LTDomain

/// Ranking tiers in the default priority order from FR7. Lower is shown first.
/// There is no score for a person or relationship; tiers only order kinds of moments.
public enum CardTier: Int, Comparable, Sendable, Codable {
    case pinned = 0
    case commitment = 1
    case date = 2
    case meeting = 3
    case context = 4
    case cadence = 5

    public static func < (lhs: CardTier, rhs: CardTier) -> Bool { lhs.rawValue < rhs.rawValue }
}

public enum CardAction: String, Sendable, Codable, CaseIterable {
    case review
    case draftMessage
    case planGift
    case remindTonight
    case snooze
    case dismiss
    case done
    case logCatchUp
    case confirmAttendance
    case setBaseline
    case openBrief
}

/// One line of "Why this appeared". Built deterministically from stored evidence.
public struct ExplanationItem: Hashable, Sendable {
    public var label: String
    public var text: String
    public var date: Date?
    public var evidence: EvidenceRef?

    public init(label: String, text: String, date: Date? = nil, evidence: EvidenceRef? = nil) {
        self.label = label
        self.text = text
        self.date = date
        self.evidence = evidence
    }
}

public struct CardExplanation: Hashable, Sendable {
    /// Plain-language reason, e.g. "Maya's birthday is within your 14-day planning window."
    public var reason: String
    public var items: [ExplanationItem]
    /// Coverage disclosure for observed-pattern cards (channels, range, freshness).
    public var coverage: String?

    public init(reason: String, items: [ExplanationItem], coverage: String? = nil) {
        self.reason = reason
        self.items = items
        self.coverage = coverage
    }
}

public struct SuggestionCard: Identifiable, Hashable, Sendable {
    public var id: String { occurrenceKey }
    public var occurrenceKey: String
    public var ruleID: SuggestionRuleID
    public var personID: PersonID
    public var tier: CardTier
    /// Time relevance used for ordering within a tier.
    public var relevantAt: Date
    public var title: String
    /// Supporting detail from confirmed evidence ("You noted that ...").
    public var detail: String?
    public var explanation: CardExplanation
    public var evidence: [EvidenceRef]
    public var actions: [CardAction]
    public var isSensitive: Bool
    public var isPinned: Bool
    /// Whether a celebratory/congratulatory draft is appropriate.
    public var allowsCelebration: Bool

    public init(
        occurrenceKey: String,
        ruleID: SuggestionRuleID,
        personID: PersonID,
        tier: CardTier,
        relevantAt: Date,
        title: String,
        detail: String? = nil,
        explanation: CardExplanation,
        evidence: [EvidenceRef],
        actions: [CardAction],
        isSensitive: Bool = false,
        isPinned: Bool = false,
        allowsCelebration: Bool = false
    ) {
        self.occurrenceKey = occurrenceKey
        self.ruleID = ruleID
        self.personID = personID
        self.tier = tier
        self.relevantAt = relevantAt
        self.title = title
        self.detail = detail
        self.explanation = explanation
        self.evidence = evidence
        self.actions = actions
        self.isSensitive = isSensitive
        self.isPinned = isPinned
        self.allowsCelebration = allowsCelebration
    }

    /// Stable ordering: tier, then time relevance, then occurrence key.
    public static func ranked(_ a: SuggestionCard, _ b: SuggestionCard) -> Bool {
        if a.tier != b.tier { return a.tier < b.tier }
        if a.relevantAt != b.relevantAt { return a.relevantAt < b.relevantAt }
        return a.occurrenceKey < b.occurrenceKey
    }
}

/// Formats days for card copy. Injected so output is deterministic in tests.
public struct DayPhrasing: Sendable {
    public var locale: Locale
    public var timeZone: TimeZone

    public init(locale: Locale = Locale(identifier: "en_US"), timeZone: TimeZone) {
        self.locale = locale
        self.timeZone = timeZone
    }

    public func monthDay(_ day: CalendarDay) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate("MMMMd")
        return formatter.string(from: day.date(at: TimeOfDay(hour: 12), in: timeZone))
    }

    public func shortMonthDay(_ day: CalendarDay) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: day.date(at: TimeOfDay(hour: 12), in: timeZone))
    }

    public func time(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate("jmm")
        return formatter.string(from: date)
    }

    /// "today", "tomorrow", "in 8 days", "yesterday", "2 days ago".
    public func relative(from today: CalendarDay, to day: CalendarDay) -> String {
        let delta = today.days(until: day)
        switch delta {
        case 0: return "today"
        case 1: return "tomorrow"
        case -1: return "yesterday"
        case 2...: return "in \(delta) days"
        default: return "\(-delta) days ago"
        }
    }

    /// Spelled-out small numbers for gentle copy ("three weeks").
    public static func words(_ n: Int) -> String {
        let names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
        return (0..<names.count).contains(n) ? names[n] : String(n)
    }
}
