import Contacts
import ContactsUI
import EventKit
import Foundation
import LTDomain
import LTIntegrations
import SwiftUI

// MARK: - Contacts

enum ContactMapping {
    static var keys: [CNKeyDescriptor] { [
        CNContactIdentifierKey as CNKeyDescriptor,
        CNContactGivenNameKey as CNKeyDescriptor,
        CNContactFamilyNameKey as CNKeyDescriptor,
        CNContactNicknameKey as CNKeyDescriptor,
        CNContactPhoneNumbersKey as CNKeyDescriptor,
        CNContactEmailAddressesKey as CNKeyDescriptor,
        CNContactBirthdayKey as CNKeyDescriptor,
        CNContactImageDataAvailableKey as CNKeyDescriptor,
    ] }

    /// Reads only fields LittleThings uses. Postal addresses are deliberately not read.
    static func imported(_ contact: CNContact) -> ImportedContact {
        func has(_ key: String) -> Bool { contact.isKeyAvailable(key) }
        let phones = has(CNContactPhoneNumbersKey) ? contact.phoneNumbers.map {
            LabeledValue(label: $0.label.map(CNLabeledValue<CNPhoneNumber>.localizedString(forLabel:)), value: $0.value.stringValue)
        } : []
        let emails = has(CNContactEmailAddressesKey) ? contact.emailAddresses.map {
            LabeledValue(label: $0.label.map(CNLabeledValue<NSString>.localizedString(forLabel:)), value: $0.value as String)
        } : []
        var birthday: AnnualDate?
        if has(CNContactBirthdayKey), let b = contact.birthday, let month = b.month, let day = b.day {
            birthday = AnnualDate(month: month, day: day, year: b.year)
        }
        return ImportedContact(
            identifier: contact.identifier,
            givenName: has(CNContactGivenNameKey) ? contact.givenName : "",
            familyName: has(CNContactFamilyNameKey) ? contact.familyName : "",
            nickname: has(CNContactNicknameKey) ? contact.nickname.nilIfBlank : nil,
            phoneNumbers: phones,
            emailAddresses: emails,
            birthday: birthday,
            hasImage: has(CNContactImageDataAvailableKey) && contact.imageDataAvailable
        )
    }
}

/// Re-reads already-linked contacts when the user has granted (limited or full) access.
struct SystemContactsProvider: ContactsProviding {
    func authorizationState() -> PermissionState {
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .authorized: return .authorized
        case .limited: return .limited
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unavailable
        }
    }

    func requestAccess() async -> PermissionState {
        _ = try? await CNContactStore().requestAccess(for: .contacts)
        return authorizationState()
    }

    func contacts(withIdentifiers identifiers: [String]) async throws -> [ImportedContact] {
        guard authorizationState().canRead, !identifiers.isEmpty else { return [] }
        let store = CNContactStore()
        let predicate = CNContact.predicateForContacts(withIdentifiers: identifiers)
        return try store.unifiedContacts(matching: predicate, keysToFetch: ContactMapping.keys).map(ContactMapping.imported)
    }
}

/// The system contact picker. Runs out of process, needs no Contacts permission, and returns
/// only the contacts the user selects ("selecting two contacts imports only those two").
struct ContactPicker: UIViewControllerRepresentable {
    var onPick: ([ImportedContact]) -> Void
    var onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick, onCancel: onCancel) }

    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        picker.displayedPropertyKeys = [CNContactPhoneNumbersKey, CNContactEmailAddressesKey, CNContactBirthdayKey]
        return picker
    }

    func updateUIViewController(_ uiViewController: CNContactPickerViewController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, CNContactPickerDelegate {
        let onPick: ([ImportedContact]) -> Void
        let onCancel: () -> Void
        init(onPick: @escaping ([ImportedContact]) -> Void, onCancel: @escaping () -> Void) {
            self.onPick = onPick
            self.onCancel = onCancel
        }
        func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
            onPick(contacts.map(ContactMapping.imported))
        }
        func contactPickerDidCancel(_ picker: CNContactPickerViewController) { onCancel() }
    }
}

// MARK: - Calendar

/// EventKit adapter. Reads only calendars the user selects; nothing is mirrored.
/// UNVERIFIED on device: revocation behaviour and recurring-occurrence lookup.
final class EventKitCalendarProvider: CalendarProviding, @unchecked Sendable {
    private let store = EKEventStore()

    func authorizationState() -> PermissionState {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess: return .authorized
        case .writeOnly: return .writeOnly
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unavailable
        }
    }

    func requestFullAccess() async -> PermissionState {
        _ = try? await store.requestFullAccessToEvents()
        return authorizationState()
    }

    func calendars() async throws -> [CalendarInfo] {
        guard authorizationState().canRead else { return [] }
        return store.calendars(for: .event).map { CalendarInfo(id: $0.calendarIdentifier, title: $0.title) }
    }

    func events(inCalendars calendarIDs: [String], from start: Date, to end: Date) async throws -> [CalendarEventInfo] {
        guard authorizationState().canRead else { return [] }
        let calendars = store.calendars(for: .event).filter { calendarIDs.contains($0.calendarIdentifier) }
        guard !calendars.isEmpty else { return [] }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
        return store.events(matching: predicate).map(Self.info)
    }

    func event(identifier: String, occurrenceStart: Date) async throws -> CalendarEventInfo? {
        guard authorizationState().canRead else { return nil }
        // Look for the specific occurrence near its original start, then fall back to the series.
        let window = store.predicateForEvents(withStart: occurrenceStart.addingTimeInterval(-86_400 * 30), end: occurrenceStart.addingTimeInterval(86_400 * 30), calendars: nil)
        if let match = store.events(matching: window).first(where: { $0.eventIdentifier == identifier && ($0.occurrenceDate == occurrenceStart || !$0.hasRecurrenceRules) }) {
            return Self.info(match)
        }
        return store.event(withIdentifier: identifier).map(Self.info)
    }

    static func info(_ event: EKEvent) -> CalendarEventInfo {
        CalendarEventInfo(
            eventIdentifier: event.eventIdentifier,
            calendarIdentifier: event.calendar.calendarIdentifier,
            title: event.title,
            startsAt: event.startDate,
            endsAt: event.endDate,
            occurrenceStart: event.occurrenceDate ?? event.startDate,
            isAllDay: event.isAllDay,
            isRecurring: event.hasRecurrenceRules,
            isCancelled: event.status == .canceled
        )
    }
}
