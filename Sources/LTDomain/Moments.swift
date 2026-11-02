import Foundation

// MARK: - Important dates (FR3)

public enum DateCategory: String, Codable, Sendable, CaseIterable {
    case birthday
    case anniversary
    /// A one-time milestone such as a first day at a new job or a recital.
    case milestone
    case customAnnual
    /// A date the user marked as needing extra care (for example a loss). Never celebratory.
    case careful

    public var isCelebratory: Bool { self != .careful }
}

public enum DateSchedule: Hashable, Codable, Sendable {
    case annual(AnnualDate)
    case once(CalendarDay)
}

public struct ImportantDate: Identifiable, Hashable, Codable, Sendable {
    public var id: ImportantDateID
    public var personID: PersonID
    public var category: DateCategory
    public var label: String
    public var schedule: DateSchedule
    /// Required before a Feb 29 annual date produces non-leap-year occurrences.
    public var leapDayPolicy: LeapDayPolicy?
    /// Days before the occurrence to remind (0 = day-of). Default birthday: [14, 0].
    public var reminderOffsetsDays: [Int]
    public var reminderTime: TimeOfDay
    /// Explicit reminder setting. Careful dates default to off and must be opted in.
    public var remindersEnabled: Bool
    public var isSensitive: Bool
    public var isPaused: Bool
    /// Occurrence days the user marked done. Completing one occurrence never removes future ones.
    public var completedOccurrences: Set<CalendarDay>
    public var confirmation: ConfirmationState
    public var sourceID: SourceID?
    public var excerpt: String?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: ImportantDateID = ImportantDateID(),
        personID: PersonID,
        category: DateCategory,
        label: String? = nil,
        schedule: DateSchedule,
        leapDayPolicy: LeapDayPolicy? = nil,
        reminderOffsetsDays: [Int]? = nil,
        reminderTime: TimeOfDay = .morning,
        remindersEnabled: Bool? = nil,
        isSensitive: Bool? = nil,
        isPaused: Bool = false,
        completedOccurrences: Set<CalendarDay> = [],
        confirmation: ConfirmationState = .confirmed,
        sourceID: SourceID? = nil,
        excerpt: String? = nil,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.personID = personID
        self.category = category
        self.label = label ?? ImportantDate.defaultLabel(for: category)
        self.schedule = schedule
        self.leapDayPolicy = leapDayPolicy
        self.reminderOffsetsDays = reminderOffsetsDays ?? ImportantDate.defaultOffsets(for: category)
        self.reminderTime = reminderTime
        let careful = category == .careful
        self.remindersEnabled = remindersEnabled ?? !careful
        self.isSensitive = isSensitive ?? careful
        self.isPaused = isPaused
        self.completedOccurrences = completedOccurrences
        self.confirmation = confirmation
        self.sourceID = sourceID
        self.excerpt = excerpt
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    public static func defaultOffsets(for category: DateCategory) -> [Int] {
        switch category {
        case .birthday: return [14, 0]
        case .anniversary: return [7, 0]
        case .milestone: return [1, 0]
        case .customAnnual: return [7, 0]
        case .careful: return [0]
        }
    }

    public static func defaultLabel(for category: DateCategory) -> String {
        switch category {
        case .birthday: return "Birthday"
        case .anniversary: return "Anniversary"
        case .milestone: return "Milestone"
        case .customAnnual: return "Yearly date"
        case .careful: return "Date to keep in mind"
        }
    }

    /// True when this is a Feb 29 annual date without a non-leap-year choice.
    public var needsLeapDayChoice: Bool {
        if case .annual(let annual) = schedule, annual.isLeapDay, leapDayPolicy == nil { return true }
        return false
    }

    /// The observed occurrence in a given year (annual) or the single day (once).
    public func occurrence(inYear year: Int) -> CalendarDay? {
        switch schedule {
        case .annual(let annual):
            return annual.observedDay(inYear: year, leapDayPolicy: leapDayPolicy)
        case .once(let day):
            return day.year == year ? day : nil
        }
    }

    /// All occurrences between two days (inclusive), in order.
    public func occurrences(from start: CalendarDay, through end: CalendarDay) -> [CalendarDay] {
        guard start <= end else { return [] }
        switch schedule {
        case .once(let day):
            return (start...end).contains(day) ? [day] : []
        case .annual:
            return (start.year...end.year).compactMap { occurrence(inYear: $0) }.filter { $0 >= start && $0 <= end }
        }
    }

    /// The first occurrence on or after `day`.
    public func nextOccurrence(onOrAfter day: CalendarDay) -> CalendarDay? {
        switch schedule {
        case .once(let once):
            return once >= day ? once : nil
        case .annual:
            for year in day.year...(day.year + 4) {
                if let occurrence = occurrence(inYear: year), occurrence >= day { return occurrence }
            }
            return nil
        }
    }

    /// Age reached on an occurrence. Only birthdays with a known birth year have an age.
    public func age(on occurrence: CalendarDay) -> Int? {
        guard category == .birthday, case .annual(let annual) = schedule, let birthYear = annual.year else {
            return nil
        }
        return occurrence.year - birthYear
    }

    public func isCompleted(_ occurrence: CalendarDay) -> Bool {
        completedOccurrences.contains(occurrence)
    }
}

// MARK: - Interactions (FR5)

public enum InteractionKind: String, Codable, Sendable, CaseIterable {
    case call
    case videoCall
    case message
    case meal
    case visit
    case meeting
    case other
}

public enum InteractionConfirmation: String, Codable, Sendable {
    /// The user said it happened.
    case userConfirmed
    /// Observed in an authorized source (import or connector). Not a claim of completeness.
    case sourceObserved
}

public struct Interaction: Identifiable, Hashable, Codable, Sendable {
    public var id: InteractionID
    public var personIDs: [PersonID]
    public var kind: InteractionKind
    public var occurredAt: Date
    public var confirmation: InteractionConfirmation
    /// Connection or provider that observed this interaction (for coverage/rhythm).
    public var channel: String?
    public var isGroup: Bool
    public var isBusiness: Bool
    public var sourceID: SourceID?
    public var summary: String?
    public var createdAt: Date

    public init(
        id: InteractionID = InteractionID(),
        personIDs: [PersonID],
        kind: InteractionKind,
        occurredAt: Date,
        confirmation: InteractionConfirmation,
        channel: String? = nil,
        isGroup: Bool = false,
        isBusiness: Bool = false,
        sourceID: SourceID? = nil,
        summary: String? = nil,
        createdAt: Date
    ) {
        self.id = id
        self.personIDs = personIDs
        self.kind = kind
        self.occurredAt = occurredAt
        self.confirmation = confirmation
        self.channel = channel
        self.isGroup = isGroup
        self.isBusiness = isBusiness
        self.sourceID = sourceID
        self.summary = summary
        self.createdAt = createdAt
    }
}

// MARK: - Promises (FR4)

public enum PromiseKind: String, Codable, Sendable {
    /// Something the user said they would do ("send Sam the book recommendation").
    case commitment
    /// Something to ask about or check on ("ask how the interview went").
    case followUp
}

public enum PromiseOwner: Hashable, Codable, Sendable {
    case me
    case person(PersonID)
}

public enum PromiseStatus: String, Codable, Sendable {
    case open
    case done
    case cancelled
}

public enum PromiseDue: Hashable, Codable, Sendable {
    case day(CalendarDay)
    case time(Date)

    public func day(in timeZone: TimeZone) -> CalendarDay {
        switch self {
        case .day(let day): return day
        case .time(let date): return CalendarDay(date: date, timeZone: timeZone)
        }
    }
}

public struct Promise: Identifiable, Hashable, Codable, Sendable {
    public var id: PromiseID
    public var personIDs: [PersonID]
    public var kind: PromiseKind
    public var owner: PromiseOwner
    public var description: String
    public var due: PromiseDue?
    public var status: PromiseStatus
    public var confirmation: ConfirmationState
    public var isPinned: Bool
    public var sourceID: SourceID?
    public var excerpt: String?
    public var completedAt: Date?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: PromiseID = PromiseID(),
        personIDs: [PersonID],
        kind: PromiseKind = .commitment,
        owner: PromiseOwner = .me,
        description: String,
        due: PromiseDue? = nil,
        status: PromiseStatus = .open,
        confirmation: ConfirmationState = .confirmed,
        isPinned: Bool = false,
        sourceID: SourceID? = nil,
        excerpt: String? = nil,
        completedAt: Date? = nil,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.personIDs = personIDs
        self.kind = kind
        self.owner = owner
        self.description = description
        self.due = due
        self.status = status
        self.confirmation = confirmation
        self.isPinned = isPinned
        self.sourceID = sourceID
        self.excerpt = excerpt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    /// A promise without a date never becomes overdue automatically (FR4).
    public func isOverdue(in context: EvaluationContext) -> Bool {
        guard status == .open, let due else { return false }
        switch due {
        case .day(let day): return day < context.today
        case .time(let date): return date < context.now
        }
    }
}

// MARK: - Calendar (FR6)

public enum CalendarContext: String, Codable, Sendable {
    case personal
    case business
}

public enum CalendarEventStatus: String, Codable, Sendable {
    case scheduled
    case cancelled
    /// The event could not be found on the last refresh (deleted or access revoked).
    case missing
}

public enum AttendanceState: String, Codable, Sendable {
    /// Planned only. A planned meeting is never treated as attended.
    case unknown
    case attended
    case didNotHappen
}

/// A user-selected calendar event occurrence associated with people. Only the fields needed
/// for the selected event are cached; the calendar itself is not mirrored.
public struct CalendarLink: Identifiable, Hashable, Codable, Sendable {
    public var id: CalendarLinkID
    public var personIDs: [PersonID]
    public var calendarIdentifier: String
    public var eventIdentifier: String
    /// Start of the specific occurrence (identifies occurrences of recurring events).
    public var occurrenceStart: Date
    public var startsAt: Date
    public var endsAt: Date
    public var isAllDay: Bool
    public var isRecurring: Bool
    /// Cached only if the user allows it.
    public var title: String?
    public var context: CalendarContext
    public var status: CalendarEventStatus
    public var attendance: AttendanceState
    public var lastRefreshedAt: Date
    public var createdAt: Date

    public init(
        id: CalendarLinkID = CalendarLinkID(),
        personIDs: [PersonID],
        calendarIdentifier: String,
        eventIdentifier: String,
        occurrenceStart: Date? = nil,
        startsAt: Date,
        endsAt: Date,
        isAllDay: Bool = false,
        isRecurring: Bool = false,
        title: String? = nil,
        context: CalendarContext = .personal,
        status: CalendarEventStatus = .scheduled,
        attendance: AttendanceState = .unknown,
        lastRefreshedAt: Date,
        createdAt: Date
    ) {
        self.id = id
        self.personIDs = personIDs
        self.calendarIdentifier = calendarIdentifier
        self.eventIdentifier = eventIdentifier
        self.occurrenceStart = occurrenceStart ?? startsAt
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.isAllDay = isAllDay
        self.isRecurring = isRecurring
        self.title = title
        self.context = context
        self.status = status
        self.attendance = attendance
        self.lastRefreshedAt = lastRefreshedAt
        self.createdAt = createdAt
    }

    /// Identity of the underlying calendar occurrence, used to deduplicate cards when the
    /// same occurrence is linked more than once.
    public var occurrenceIdentity: String {
        "\(eventIdentifier)@\(Int(occurrenceStart.timeIntervalSince1970))"
    }
}

// MARK: - Gifts (FR9)

/// Money in minor units to avoid floating-point rounding.
public struct Money: Hashable, Codable, Sendable {
    public var minorUnits: Int64
    public var currencyCode: String

    public init(minorUnits: Int64, currencyCode: String) {
        self.minorUnits = minorUnits
        self.currencyCode = currencyCode.uppercased()
    }
}

public enum GiftState: String, Codable, Sendable, CaseIterable {
    case idea
    case planned
    /// Marked purchased by the user. Never inferred from opening a link.
    case purchased
    case given
}

public struct GiftIdea: Identifiable, Hashable, Codable, Sendable {
    public var id: GiftIdeaID
    public var personID: PersonID
    public var title: String
    public var details: String?
    public var url: URL?
    public var size: String?
    public var budget: Money?
    public var occasionDateID: ImportantDateID?
    public var shippingLeadDays: Int?
    public var state: GiftState
    public var givenOn: CalendarDay?
    public var stateChangedAt: Date
    public var createdAt: Date

    public init(
        id: GiftIdeaID = GiftIdeaID(),
        personID: PersonID,
        title: String,
        details: String? = nil,
        url: URL? = nil,
        size: String? = nil,
        budget: Money? = nil,
        occasionDateID: ImportantDateID? = nil,
        shippingLeadDays: Int? = nil,
        state: GiftState = .idea,
        givenOn: CalendarDay? = nil,
        createdAt: Date,
        stateChangedAt: Date? = nil
    ) {
        self.id = id
        self.personID = personID
        self.title = title
        self.details = details
        self.url = url
        self.size = size
        self.budget = budget
        self.occasionDateID = occasionDateID
        self.shippingLeadDays = shippingLeadDays
        self.state = state
        self.givenOn = givenOn
        self.createdAt = createdAt
        self.stateChangedAt = stateChangedAt ?? createdAt
    }

    /// Normalized identity used to avoid suggesting an item already given.
    public var normalizedIdentity: String {
        if let url, let host = url.host {
            return (host + url.path).lowercased()
        }
        return title.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
    }
}

// MARK: - Travel (FR15)

public struct Trip: Identifiable, Hashable, Codable, Sendable {
    public var id: TripID
    public var city: String
    public var startDay: CalendarDay
    public var endDay: CalendarDay
    /// Uncertain plans are labelled as such and never stated as fact.
    public var isUncertain: Bool
    public var createdAt: Date

    public init(id: TripID = TripID(), city: String, startDay: CalendarDay, endDay: CalendarDay, isUncertain: Bool = false, createdAt: Date) {
        self.id = id
        self.city = city
        self.startDay = startDay
        self.endDay = max(startDay, endDay)
        self.isUncertain = isUncertain
        self.createdAt = createdAt
    }
}

// MARK: - Life updates and interests (FR13)

public enum LifeEventCategory: String, Codable, Sendable, CaseIterable {
    case newJob
    case move
    case graduation
    case familyMilestone
    case performance
    case interest
    case other
}

public enum Explicitness: String, Codable, Sendable {
    /// Directly stated about this person in the source.
    case explicit
    /// An interpretation (weak). Never presented as fact.
    case inferred
}

public enum SignalStrength: String, Codable, Sendable {
    /// A single like or passing mention. Must not become a confident preference.
    case weak
    case normal
}

public struct LifeEvent: Identifiable, Hashable, Codable, Sendable {
    public var id: LifeEventID
    public var personID: PersonID
    public var category: LifeEventCategory
    public var summary: String
    public var sourceIDs: [SourceID]
    public var excerpt: String
    /// When it happened, if the source says so. Missing dates stay missing.
    public var eventDay: CalendarDay?
    /// When the source was captured.
    public var capturedAt: Date
    public var explicitness: Explicitness
    public var signal: SignalStrength
    public var confirmation: ConfirmationState
    public var isSensitive: Bool
    public var isDismissed: Bool
    public var createdAt: Date

    public init(
        id: LifeEventID = LifeEventID(),
        personID: PersonID,
        category: LifeEventCategory,
        summary: String,
        sourceIDs: [SourceID],
        excerpt: String,
        eventDay: CalendarDay? = nil,
        capturedAt: Date,
        explicitness: Explicitness = .explicit,
        signal: SignalStrength = .normal,
        confirmation: ConfirmationState = .unconfirmed,
        isSensitive: Bool = false,
        isDismissed: Bool = false,
        createdAt: Date
    ) {
        self.id = id
        self.personID = personID
        self.category = category
        self.summary = summary
        self.sourceIDs = sourceIDs
        self.excerpt = excerpt
        self.eventDay = eventDay
        self.capturedAt = capturedAt
        self.explicitness = explicitness
        self.signal = signal
        self.confirmation = confirmation
        self.isSensitive = isSensitive
        self.isDismissed = isDismissed
        self.createdAt = createdAt
    }

    /// Cross-source identity: one real-world event seen in several sources yields one card.
    public var dedupeKey: String {
        let normalized = summary.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
        return "\(personID)|\(category.rawValue)|\(normalized)"
    }
}
