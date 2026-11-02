import Foundation

/// A UUID-backed identifier tagged with the record type it identifies, so a `PersonID`
/// can never be passed where a `SourceID` is expected.
public struct EntityID<Tag>: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    public let rawValue: UUID

    public init(_ rawValue: UUID = UUID()) {
        self.rawValue = rawValue
    }

    public init?(uuidString: String) {
        guard let uuid = UUID(uuidString: uuidString) else { return nil }
        self.rawValue = uuid
    }

    public var uuidString: String { rawValue.uuidString }
    public var description: String { rawValue.uuidString }

    public static func < (lhs: Self, rhs: Self) -> Bool {
        lhs.rawValue.uuidString < rhs.rawValue.uuidString
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        rawValue = try container.decode(UUID.self)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public typealias PersonID = EntityID<Person>
public typealias SourceID = EntityID<Source>
public typealias FactID = EntityID<Fact>
public typealias ImportantDateID = EntityID<ImportantDate>
public typealias InteractionID = EntityID<Interaction>
public typealias PromiseID = EntityID<Promise>
public typealias CalendarLinkID = EntityID<CalendarLink>
public typealias GiftIdeaID = EntityID<GiftIdea>
public typealias SuggestionID = EntityID<SuggestionRecord>
public typealias DraftID = EntityID<Draft>
public typealias ConnectionID = EntityID<Connection>
public typealias CaptureRecordID = EntityID<CaptureRecord>
public typealias LifeEventID = EntityID<LifeEvent>
public typealias TripID = EntityID<Trip>
public typealias AutomationRuleID = EntityID<AutomationRule>
public typealias ActionAttemptID = EntityID<ActionAttempt>
public typealias ImportBatchID = EntityID<ImportBatch>

/// Marker type for import batch identifiers.
public enum ImportBatch {}
