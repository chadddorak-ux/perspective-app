import Foundation
import LTDomain

/// Applies a calendar refresh to linked events (FR6). Pure.
public enum CalendarReconciler {
    public enum RefreshInput: Sendable {
        /// Permission denied or revoked: nothing can be read. Links keep their last known
        /// state; the UI shows an honest unavailable state with the last refresh time.
        case accessUnavailable
        /// Fresh results keyed by `CalendarLink.id`; a `nil` value means the occurrence is gone.
        case events([CalendarLinkID: CalendarEventInfo?])
    }

    public static func reconcile(
        _ links: [CalendarLink],
        with input: RefreshInput,
        cacheTitles: Bool,
        now: Date
    ) -> [RecordChange] {
        guard case .events(let results) = input else { return [] }
        var changes: [RecordChange] = []
        for link in links.sorted(by: { $0.id < $1.id }) {
            guard let fetched = results[link.id] else { continue } // not refreshed this round
            var updated = link
            updated.lastRefreshedAt = now
            if let event = fetched {
                updated.status = event.isCancelled ? .cancelled : .scheduled
                if !link.isRecurring {
                    // A moved one-off event keeps its identity and gets new times.
                    updated.occurrenceStart = event.startsAt
                }
                updated.startsAt = event.startsAt
                updated.endsAt = event.endsAt
                updated.isAllDay = event.isAllDay
                updated.title = cacheTitles ? event.title : nil
            } else {
                updated.status = .missing
            }
            if updated != link {
                changes.append(.upsert(.calendarLink(updated)))
            }
        }
        return changes
    }

    /// Creates a link for an event the user selected. Only permitted fields are cached.
    public static func link(for event: CalendarEventInfo, people: [PersonID], context: CalendarContext, cacheTitles: Bool, now: Date) -> CalendarLink {
        CalendarLink(
            personIDs: people,
            calendarIdentifier: event.calendarIdentifier,
            eventIdentifier: event.eventIdentifier,
            occurrenceStart: event.occurrenceStart,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            isAllDay: event.isAllDay,
            isRecurring: event.isRecurring,
            title: cacheTitles ? event.title : nil,
            context: context,
            lastRefreshedAt: now,
            createdAt: now
        )
    }

    /// Records the user's answer to "Did it happen?". Only a confirmed attendance creates an
    /// interaction; a planned event never counts on its own.
    public static func confirmAttendance(_ link: CalendarLink, happened: Bool, now: Date) -> [RecordChange] {
        var updated = link
        updated.attendance = happened ? .attended : .didNotHappen
        var changes: [RecordChange] = [.upsert(.calendarLink(updated))]
        if happened {
            let interaction = Interaction(
                personIDs: link.personIDs,
                kind: .meeting,
                occurredAt: link.startsAt,
                confirmation: .userConfirmed,
                isBusiness: link.context == .business,
                summary: link.title,
                createdAt: now
            )
            changes.append(.upsert(.interaction(interaction)))
        }
        return changes
    }
}

/// Maps a contact the user selected into a person plus reviewable candidates (FR1).
public enum ContactImportPlanner {
    public struct Plan: Sendable {
        public var person: Person
        /// The contact's birthday, offered for review; never silently confirmed.
        public var birthdayCandidate: ImportantDate?
        public var source: Source
    }

    public static func plan(for contact: ImportedContact, now: Date, isDemo: Bool = false) -> Plan {
        let person = Person(
            displayName: contact.displayName,
            preferredName: contact.nickname?.nilIfBlank,
            phoneNumbers: contact.phoneNumbers,
            emailAddresses: contact.emailAddresses,
            contactReference: ContactReference(identifier: contact.identifier, linkedAt: now),
            isDemo: isDemo,
            createdAt: now
        )
        let source = Source(kind: .contactsImport, provider: "contacts", title: "Contacts", capturedAt: now, text: "Imported from Contacts: name, phone numbers, email addresses\(contact.birthday == nil ? "" : ", birthday").", personIDs: [person.id], isDemo: isDemo)
        let birthday = contact.birthday.map {
            ImportantDate(personID: person.id, category: .birthday, schedule: .annual($0), confirmation: .unconfirmed, sourceID: source.id, excerpt: "Birthday on contact card", createdAt: now)
        }
        return Plan(person: person, birthdayCandidate: birthday, source: source)
    }

    /// Refreshes contact fields for a linked person. Never touches user-entered fields
    /// (address, notes, city) and never writes back to the system address book.
    public static func refresh(_ person: Person, from contact: ImportedContact, now: Date) -> Person? {
        guard person.contactReference?.identifier == contact.identifier else { return nil }
        var updated = person
        updated.phoneNumbers = mergeLabeled(person.phoneNumbers, contact.phoneNumbers, match: ContactNormalizer.phonesMatch)
        updated.emailAddresses = mergeLabeled(person.emailAddresses, contact.emailAddresses) {
            ContactNormalizer.normalizeEmail($0) == ContactNormalizer.normalizeEmail($1)
        }
        guard updated != person else { return nil }
        updated.updatedAt = now
        return updated
    }

    static func mergeLabeled(_ existing: [LabeledValue], _ incoming: [LabeledValue], match: (String, String) -> Bool) -> [LabeledValue] {
        existing + incoming.filter { candidate in !existing.contains { match($0.value, candidate.value) } }
    }
}
