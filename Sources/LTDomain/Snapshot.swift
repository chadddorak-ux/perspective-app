import Foundation

/// Any persisted record.
public enum VaultRecord: Hashable, Sendable {
    case person(Person)
    case source(Source)
    case fact(Fact)
    case importantDate(ImportantDate)
    case interaction(Interaction)
    case promise(Promise)
    case calendarLink(CalendarLink)
    case gift(GiftIdea)
    case suggestion(SuggestionRecord)
    case draft(Draft)
    case connection(Connection)
    case captureRecord(CaptureRecord)
    case lifeEvent(LifeEvent)
    case trip(Trip)
    case automationRule(AutomationRule)
    case actionAttempt(ActionAttempt)

    public var key: RecordKey {
        switch self {
        case .person(let r): return .person(r.id)
        case .source(let r): return .source(r.id)
        case .fact(let r): return .fact(r.id)
        case .importantDate(let r): return .importantDate(r.id)
        case .interaction(let r): return .interaction(r.id)
        case .promise(let r): return .promise(r.id)
        case .calendarLink(let r): return .calendarLink(r.id)
        case .gift(let r): return .gift(r.id)
        case .suggestion(let r): return .suggestion(r.occurrenceKey)
        case .draft(let r): return .draft(r.id)
        case .connection(let r): return .connection(r.id)
        case .captureRecord(let r): return .captureRecord(r.id)
        case .lifeEvent(let r): return .lifeEvent(r.id)
        case .trip(let r): return .trip(r.id)
        case .automationRule(let r): return .automationRule(r.id)
        case .actionAttempt(let r): return .actionAttempt(r.id)
        }
    }
}

public enum RecordKey: Hashable, Sendable {
    case person(PersonID)
    case source(SourceID)
    case fact(FactID)
    case importantDate(ImportantDateID)
    case interaction(InteractionID)
    case promise(PromiseID)
    case calendarLink(CalendarLinkID)
    case gift(GiftIdeaID)
    case suggestion(String)
    case draft(DraftID)
    case connection(ConnectionID)
    case captureRecord(CaptureRecordID)
    case lifeEvent(LifeEventID)
    case trip(TripID)
    case automationRule(AutomationRuleID)
    case actionAttempt(ActionAttemptID)
}

public enum RecordChange: Hashable, Sendable {
    case upsert(VaultRecord)
    case delete(RecordKey)
    case setPreferences(Preferences)
}

/// The full decrypted working set held in memory while the vault is unlocked.
public struct VaultSnapshot: Hashable, Sendable {
    public var people: [PersonID: Person] = [:]
    public var sources: [SourceID: Source] = [:]
    public var facts: [FactID: Fact] = [:]
    public var importantDates: [ImportantDateID: ImportantDate] = [:]
    public var interactions: [InteractionID: Interaction] = [:]
    public var promises: [PromiseID: Promise] = [:]
    public var calendarLinks: [CalendarLinkID: CalendarLink] = [:]
    public var gifts: [GiftIdeaID: GiftIdea] = [:]
    public var suggestions: [String: SuggestionRecord] = [:]
    public var drafts: [DraftID: Draft] = [:]
    public var connections: [ConnectionID: Connection] = [:]
    public var captureRecords: [CaptureRecordID: CaptureRecord] = [:]
    public var lifeEvents: [LifeEventID: LifeEvent] = [:]
    public var trips: [TripID: Trip] = [:]
    public var automationRules: [AutomationRuleID: AutomationRule] = [:]
    public var actionAttempts: [ActionAttemptID: ActionAttempt] = [:]
    public var preferences: Preferences = Preferences()

    public init() {}

    public mutating func apply(_ change: RecordChange) {
        switch change {
        case .setPreferences(let preferences):
            self.preferences = preferences
        case .upsert(let record):
            switch record {
            case .person(let r): people[r.id] = r
            case .source(let r): sources[r.id] = r
            case .fact(let r): facts[r.id] = r
            case .importantDate(let r): importantDates[r.id] = r
            case .interaction(let r): interactions[r.id] = r
            case .promise(let r): promises[r.id] = r
            case .calendarLink(let r): calendarLinks[r.id] = r
            case .gift(let r): gifts[r.id] = r
            case .suggestion(let r): suggestions[r.occurrenceKey] = r
            case .draft(let r): drafts[r.id] = r
            case .connection(let r): connections[r.id] = r
            case .captureRecord(let r): captureRecords[r.id] = r
            case .lifeEvent(let r): lifeEvents[r.id] = r
            case .trip(let r): trips[r.id] = r
            case .automationRule(let r): automationRules[r.id] = r
            case .actionAttempt(let r): actionAttempts[r.id] = r
            }
        case .delete(let key):
            switch key {
            case .person(let id): people[id] = nil
            case .source(let id): sources[id] = nil
            case .fact(let id): facts[id] = nil
            case .importantDate(let id): importantDates[id] = nil
            case .interaction(let id): interactions[id] = nil
            case .promise(let id): promises[id] = nil
            case .calendarLink(let id): calendarLinks[id] = nil
            case .gift(let id): gifts[id] = nil
            case .suggestion(let key): suggestions[key] = nil
            case .draft(let id): drafts[id] = nil
            case .connection(let id): connections[id] = nil
            case .captureRecord(let id): captureRecords[id] = nil
            case .lifeEvent(let id): lifeEvents[id] = nil
            case .trip(let id): trips[id] = nil
            case .automationRule(let id): automationRules[id] = nil
            case .actionAttempt(let id): actionAttempts[id] = nil
            }
        }
    }

    public mutating func apply(_ changes: [RecordChange]) {
        for change in changes { apply(change) }
    }

    /// Every record as an upsert, in a deterministic order (used for backup and restore).
    public var allRecords: [VaultRecord] {
        var records: [VaultRecord] = []
        records += people.values.sorted { $0.id < $1.id }.map(VaultRecord.person)
        records += sources.values.sorted { $0.id < $1.id }.map(VaultRecord.source)
        records += facts.values.sorted { $0.id < $1.id }.map(VaultRecord.fact)
        records += importantDates.values.sorted { $0.id < $1.id }.map(VaultRecord.importantDate)
        records += interactions.values.sorted { $0.id < $1.id }.map(VaultRecord.interaction)
        records += promises.values.sorted { $0.id < $1.id }.map(VaultRecord.promise)
        records += calendarLinks.values.sorted { $0.id < $1.id }.map(VaultRecord.calendarLink)
        records += gifts.values.sorted { $0.id < $1.id }.map(VaultRecord.gift)
        records += suggestions.values.sorted { $0.occurrenceKey < $1.occurrenceKey }.map(VaultRecord.suggestion)
        records += drafts.values.sorted { $0.id < $1.id }.map(VaultRecord.draft)
        records += connections.values.sorted { $0.id < $1.id }.map(VaultRecord.connection)
        records += captureRecords.values.sorted { $0.id < $1.id }.map(VaultRecord.captureRecord)
        records += lifeEvents.values.sorted { $0.id < $1.id }.map(VaultRecord.lifeEvent)
        records += trips.values.sorted { $0.id < $1.id }.map(VaultRecord.trip)
        records += automationRules.values.sorted { $0.id < $1.id }.map(VaultRecord.automationRule)
        records += actionAttempts.values.sorted { $0.id < $1.id }.map(VaultRecord.actionAttempt)
        return records
    }

    public var recordCount: Int { allRecords.count }

    /// Living (non-archived) people sorted by name for display.
    public var activePeople: [Person] {
        people.values.filter { !$0.isArchived }.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    public var containsDemoData: Bool { people.values.contains { $0.isDemo } }
    public var containsRealData: Bool { people.values.contains { !$0.isDemo } }

    /// Referential integrity problems (empty when consistent). Used to validate restores.
    public func referentialProblems() -> [String] {
        var problems: [String] = []
        func checkPerson(_ id: PersonID, _ what: String) {
            if people[id] == nil { problems.append("\(what) references a missing person") }
        }
        func checkSource(_ id: SourceID?, _ what: String) {
            if let id, sources[id] == nil { problems.append("\(what) references a missing source") }
        }
        for s in sources.values { s.personIDs.forEach { checkPerson($0, "source") } }
        for f in facts.values { checkPerson(f.personID, "fact"); checkSource(f.sourceID, "fact") }
        for d in importantDates.values { checkPerson(d.personID, "date"); checkSource(d.sourceID, "date") }
        for i in interactions.values { i.personIDs.forEach { checkPerson($0, "interaction") }; checkSource(i.sourceID, "interaction") }
        for p in promises.values { p.personIDs.forEach { checkPerson($0, "promise") }; checkSource(p.sourceID, "promise") }
        for c in calendarLinks.values { c.personIDs.forEach { checkPerson($0, "calendar link") } }
        for g in gifts.values {
            checkPerson(g.personID, "gift")
            if let occasion = g.occasionDateID, importantDates[occasion] == nil { problems.append("gift references a missing date") }
        }
        for s in suggestions.values { checkPerson(s.personID, "suggestion") }
        for d in drafts.values { checkPerson(d.personID, "draft") }
        for c in captureRecords.values {
            checkSource(c.sourceID, "capture record")
            if let i = c.interactionID, interactions[i] == nil { problems.append("capture record references a missing interaction") }
        }
        for e in lifeEvents.values { checkPerson(e.personID, "life event"); e.sourceIDs.forEach { checkSource($0, "life event") } }
        for r in automationRules.values { r.recipients.forEach { checkPerson($0.personID, "automation rule") } }
        return problems
    }
}
