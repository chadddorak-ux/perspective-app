import Foundation
import LTDomain
import LTSuggestions

// MARK: - Review queue

/// Source-derived records waiting for the user's decision.
public enum ReviewItem: Hashable, Sendable, Identifiable {
    case fact(FactID)
    case date(ImportantDateID)
    case promise(PromiseID)
    case lifeEvent(LifeEventID)
    case leapDayChoice(ImportantDateID)

    public var id: String {
        switch self {
        case .fact(let id): return "fact:\(id)"
        case .date(let id): return "date:\(id)"
        case .promise(let id): return "promise:\(id)"
        case .lifeEvent(let id): return "life:\(id)"
        case .leapDayChoice(let id): return "leap:\(id)"
        }
    }
}

public enum ReviewQueue {
    public static func items(in snapshot: VaultSnapshot) -> [ReviewItem] {
        var items: [ReviewItem] = []
        items += snapshot.importantDates.values.filter { $0.confirmation != .confirmed }.sorted { $0.id < $1.id }.map { .date($0.id) }
        items += snapshot.importantDates.values.filter { $0.confirmation == .confirmed && $0.needsLeapDayChoice }.sorted { $0.id < $1.id }.map { .leapDayChoice($0.id) }
        items += snapshot.promises.values.filter { $0.confirmation != .confirmed && $0.status == .open }.sorted { $0.id < $1.id }.map { .promise($0.id) }
        items += snapshot.lifeEvents.values.filter { $0.confirmation != .confirmed && !$0.isDismissed }.sorted { $0.id < $1.id }.map { .lifeEvent($0.id) }
        items += snapshot.facts.values.filter { $0.state != .confirmed }.sorted { $0.id < $1.id }.map { .fact($0.id) }
        return items
    }

    public static func changes(for item: ReviewItem, accept: Bool, leapDayPolicy: LeapDayPolicy?, in snapshot: VaultSnapshot, now: Date) -> [RecordChange] {
        switch item {
        case .fact(let id):
            guard var fact = snapshot.facts[id] else { return [] }
            if !accept { return [.delete(.fact(id))] }
            fact.state = .confirmed
            fact.updatedAt = now
            return [.upsert(.fact(fact))]
        case .date(let id):
            guard var date = snapshot.importantDates[id] else { return [] }
            if !accept { return [.delete(.importantDate(id))] }
            date.confirmation = .confirmed
            if date.leapDayPolicy == nil { date.leapDayPolicy = leapDayPolicy }
            date.updatedAt = now
            return [.upsert(.importantDate(date))]
        case .leapDayChoice(let id):
            guard var date = snapshot.importantDates[id], let leapDayPolicy else { return [] }
            date.leapDayPolicy = leapDayPolicy
            date.updatedAt = now
            return [.upsert(.importantDate(date))]
        case .promise(let id):
            guard var promise = snapshot.promises[id] else { return [] }
            if !accept {
                promise.status = .cancelled
            } else {
                promise.confirmation = .confirmed
            }
            promise.updatedAt = now
            return [.upsert(.promise(promise))]
        case .lifeEvent(let id):
            guard var event = snapshot.lifeEvents[id] else { return [] }
            if accept { event.confirmation = .confirmed } else { event.isDismissed = true }
            return [.upsert(.lifeEvent(event))]
        }
    }
}

// MARK: - Local search

public struct SearchResult: Hashable, Sendable, Identifiable {
    public enum Kind: String, Sendable { case person, note, detail, promise, gift }
    public var id: String
    public var kind: Kind
    public var personID: PersonID?
    public var title: String
    public var snippet: String
}

/// P0 local string search over the in-memory, decrypted snapshot. There is no separate
/// index, so deleted text cannot linger in one.
public enum LocalSearch {
    public static func search(_ query: String, in snapshot: VaultSnapshot, limit: Int = 50) -> [SearchResult] {
        let terms = Grounding.terms(query)
        guard !terms.isEmpty else { return [] }
        func matches(_ text: String?) -> Bool {
            guard let text else { return false }
            let folded = Grounding.fold(text)
            return terms.allSatisfy(folded.contains)
        }
        func snippet(_ text: String) -> String {
            let folded = Grounding.fold(text)
            guard let first = terms.first, let range = folded.range(of: first) else { return String(text.prefix(80)) }
            let offset = folded.distance(from: folded.startIndex, to: range.lowerBound)
            let start = text.index(text.startIndex, offsetBy: max(0, min(offset - 30, text.count)))
            return (start > text.startIndex ? "…" : "") + String(text[start...].prefix(100))
        }
        var results: [SearchResult] = []
        for p in snapshot.people.values where matches([p.displayName, p.preferredName, p.relationshipLabel, p.city, p.notes, p.circles.joined(separator: " ")].compactMap { $0 }.joined(separator: " ")) {
            results.append(SearchResult(id: "person:\(p.id)", kind: .person, personID: p.id, title: p.name, snippet: [p.relationshipLabel, p.city].compactMap { $0 }.joined(separator: " · ")))
        }
        for s in snapshot.sources.values where matches(s.text) {
            results.append(SearchResult(id: "source:\(s.id)", kind: .note, personID: s.personIDs.first, title: s.title ?? "Note", snippet: snippet(s.text)))
        }
        for f in snapshot.facts.values where matches(f.label + " " + f.value) {
            results.append(SearchResult(id: "fact:\(f.id)", kind: .detail, personID: f.personID, title: f.label, snippet: f.value))
        }
        for p in snapshot.promises.values where p.status == .open && matches(p.description) {
            results.append(SearchResult(id: "promise:\(p.id)", kind: .promise, personID: p.personIDs.first, title: "Promise", snippet: p.description))
        }
        for g in snapshot.gifts.values where matches(g.title + " " + (g.details ?? "")) {
            results.append(SearchResult(id: "gift:\(g.id)", kind: .gift, personID: g.personID, title: "Gift idea", snippet: g.title))
        }
        return Array(results.sorted { ($0.kind.rawValue, $0.title, $0.id) < ($1.kind.rawValue, $1.title, $1.id) }.prefix(limit))
    }
}

enum Grounding {
    static func fold(_ text: String) -> String {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
    }

    static func terms(_ query: String) -> [String] {
        fold(query).split(whereSeparator: { $0.isWhitespace }).map(String.init)
    }
}

// MARK: - Upcoming

public struct UpcomingItem: Hashable, Sendable, Identifiable {
    public enum Kind: String, Sendable { case date, promise, event, trip }
    public var id: String
    public var kind: Kind
    public var day: CalendarDay
    public var personID: PersonID?
    public var title: String
    public var detail: String?
    public var isSensitive: Bool
}

/// Chronological list of confirmed dates and planned actions.
public enum UpcomingBuilder {
    public static func items(in snapshot: VaultSnapshot, context: EvaluationContext, days: Int, locale: Locale) -> [UpcomingItem] {
        let today = context.today
        let end = today.adding(days: days)
        var items: [UpcomingItem] = []
        for date in snapshot.importantDates.values where date.confirmation == .confirmed && !date.isPaused {
            guard let person = snapshot.people[date.personID], !person.isArchived else { continue }
            for day in date.occurrences(from: today, through: end) {
                let age = date.age(on: day).map { " (turns \($0))" } ?? ""
                items.append(UpcomingItem(id: "date:\(date.id):\(day.isoString)", kind: .date, day: day, personID: person.id, title: "\(person.name): \(date.label)\(age)", detail: date.isCompleted(day) ? "Done" : nil, isSensitive: date.isSensitive))
            }
        }
        for promise in snapshot.promises.values where promise.status == .open && promise.confirmation == .confirmed {
            guard let due = promise.due else { continue }
            let day = due.day(in: context.timeZone)
            guard day <= end else { continue }
            let name = promise.personIDs.compactMap { snapshot.people[$0]?.name }.joined(separator: ", ")
            items.append(UpcomingItem(id: "promise:\(promise.id)", kind: .promise, day: max(day, today), personID: promise.personIDs.first, title: promise.description, detail: day < today ? "Overdue · \(name)" : name, isSensitive: false))
        }
        for link in snapshot.calendarLinks.values where link.status == .scheduled {
            let day = CalendarDay(date: link.startsAt, timeZone: context.timeZone)
            guard day >= today, day <= end else { continue }
            let names = link.personIDs.compactMap { snapshot.people[$0]?.name }.joined(separator: ", ")
            items.append(UpcomingItem(id: "event:\(link.id)", kind: .event, day: day, personID: link.personIDs.first, title: "Scheduled: \(link.title ?? "event")", detail: names, isSensitive: false))
        }
        for trip in snapshot.trips.values where trip.endDay >= today && trip.startDay <= end {
            items.append(UpcomingItem(id: "trip:\(trip.id)", kind: .trip, day: max(trip.startDay, today), personID: nil, title: "Trip to \(trip.city)", detail: trip.isUncertain ? "Not confirmed" : nil, isSensitive: false))
        }
        return items.sorted { ($0.day, $0.kind.rawValue, $0.id) < ($1.day, $1.kind.rawValue, $1.id) }
    }
}

// MARK: - Person timeline

public struct TimelineEntry: Hashable, Sendable, Identifiable {
    public enum Kind: String, Sendable { case note, interaction, lifeUpdate, gift }
    public var id: String
    public var kind: Kind
    public var date: Date
    public var title: String
    public var detail: String?
    /// "Logged", "Seen in WhatsApp export", "Unconfirmed" etc.
    public var provenance: String
}

public enum TimelineBuilder {
    public static func entries(for personID: PersonID, in snapshot: VaultSnapshot, limit: Int = 200) -> [TimelineEntry] {
        var entries: [TimelineEntry] = []
        for s in snapshot.sources.values where s.personIDs.contains(personID) {
            entries.append(TimelineEntry(id: "source:\(s.id)", kind: .note, date: s.capturedAt, title: s.title ?? "Note", detail: String(s.text.prefix(240)), provenance: s.kind == .manualNote ? "Your note" : (s.provider ?? s.kind.rawValue)))
        }
        for i in snapshot.interactions.values where i.personIDs.contains(personID) {
            let provenance = i.confirmation == .userConfirmed ? "Logged" : "Seen in \(i.channel.flatMap { ConnectionID(uuidString: $0) }.flatMap { snapshot.connections[$0]?.displayName } ?? "a connected source")"
            entries.append(TimelineEntry(id: "interaction:\(i.id)", kind: .interaction, date: i.occurredAt, title: i.kind.rawValue.capitalized + (i.isGroup ? " (group)" : ""), detail: i.summary, provenance: provenance))
        }
        for e in snapshot.lifeEvents.values where e.personID == personID && !e.isDismissed {
            entries.append(TimelineEntry(id: "life:\(e.id)", kind: .lifeUpdate, date: e.capturedAt, title: e.summary, detail: e.eventDay.map { "On \($0.isoString)" }, provenance: e.confirmation == .confirmed ? "Confirmed" : "Unconfirmed"))
        }
        for g in snapshot.gifts.values where g.personID == personID && g.state == .given {
            entries.append(TimelineEntry(id: "gift:\(g.id)", kind: .gift, date: g.stateChangedAt, title: "Gave: \(g.title)", detail: nil, provenance: "Logged"))
        }
        return Array(entries.sorted { ($0.date, $0.id) > ($1.date, $1.id) }.prefix(limit))
    }
}
