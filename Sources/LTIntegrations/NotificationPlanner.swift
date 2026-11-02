import Foundation
import LTCryptoSupport
import LTDomain
import LTSuggestions

public enum NotificationTrigger: Hashable, Sendable {
    /// Local wall-clock time that follows the device time zone (date-only reminders).
    case floating(CalendarDay, TimeOfDay)
    /// A fixed instant (timed events, snoozes).
    case absolute(Date)

    public func fireDate(in timeZone: TimeZone) -> Date {
        switch self {
        case .floating(let day, let time): return day.date(at: time, in: timeZone)
        case .absolute(let date): return date
        }
    }
}

public enum PlannedNotificationKind: String, Sendable, Hashable {
    case dateReminder
    case promiseDue
    case meetingBrief
    case snoozedCard
    case digest
}

public struct PlannedNotification: Hashable, Sendable, Identifiable {
    public var id: String { identifier }
    /// Opaque, content-free identifier ("lt." + digest). Never contains names or text.
    public var identifier: String
    public var kind: PlannedNotificationKind
    public var trigger: NotificationTrigger
    public var title: String
    public var body: String
    public var isSensitive: Bool
}

/// Plans a bounded rolling window of local notifications (FR10). Pure and idempotent: the
/// same snapshot and context always produce the same identifiers.
///
/// iOS keeps at most 64 pending local notifications per app (Apple engineer statement on the
/// developer forums; see capability matrix row `platform-local-notification-limit`). The
/// planner caps at 48 to leave headroom, and the app reconciles on activation and after edits.
public struct NotificationPlanner: Sendable {
    public var windowDays: Int
    public var maxPending: Int
    public var meetingBriefLeadMinutes: Int
    public var engine: SuggestionEngine

    public static let genericTitle = "LittleThings"
    public static let genericBody = "You have a relationship reminder."
    public static let identifierPrefix = "lt."

    public init(windowDays: Int = 14, maxPending: Int = 48, meetingBriefLeadMinutes: Int = 60, engine: SuggestionEngine = SuggestionEngine()) {
        self.windowDays = windowDays
        self.maxPending = maxPending
        self.meetingBriefLeadMinutes = meetingBriefLeadMinutes
        self.engine = engine
    }

    public func plan(_ snapshot: VaultSnapshot, context: EvaluationContext) -> [PlannedNotification] {
        let preferences = snapshot.preferences
        let detailed = preferences.notificationPrivacy == .detailed
        let today = context.today
        let windowEnd = today.adding(days: windowDays)
        let phrasing = DayPhrasing(locale: engine.locale, timeZone: context.timeZone)
        var planned: [PlannedNotification] = []

        func eligible(_ id: PersonID) -> Person? {
            guard let person = snapshot.people[id], person.isEligibleForSuggestions else { return nil }
            return person
        }

        func add(_ kind: PlannedNotificationKind, key: String, trigger: NotificationTrigger, detailTitle: String, detailBody: String, sensitive: Bool, quiet: Bool = true) {
            var trigger = trigger
            if quiet, case .floating(let day, let time) = trigger {
                let (d, t) = preferences.quietHours.adjust(day: day, time: time)
                trigger = .floating(d, t)
            }
            if quiet, case .absolute(let date) = trigger {
                let localDay = CalendarDay(date: date, timeZone: context.timeZone)
                let localTime = TimeOfDay(date: date, timeZone: context.timeZone)
                if preferences.quietHours.contains(localTime) {
                    let (d, t) = preferences.quietHours.adjust(day: localDay, time: localTime)
                    trigger = .absolute(d.date(at: t, in: context.timeZone))
                }
            }
            guard trigger.fireDate(in: context.timeZone) > context.now else { return }
            let showDetail = detailed && !sensitive
            let title = showDetail ? detailTitle : NotificationPlanner.genericTitle
            let body = showDetail ? detailBody : NotificationPlanner.genericBody
            planned.append(PlannedNotification(
                identifier: NotificationPlanner.identifier(kind: kind, key: key, trigger: trigger, title: title, body: body),
                kind: kind,
                trigger: trigger,
                title: title,
                body: body,
                isSensitive: sensitive
            ))
        }

        // Explicit date reminders.
        for date in snapshot.importantDates.values.sorted(by: { $0.id < $1.id }) {
            guard let person = eligible(date.personID), !date.isPaused, date.remindersEnabled, date.confirmation == .confirmed else { continue }
            let maxOffset = date.reminderOffsetsDays.max() ?? 0
            for occurrence in date.occurrences(from: today, through: windowEnd.adding(days: maxOffset)) where !date.isCompleted(occurrence) {
                for offset in Set(date.reminderOffsetsDays).sorted() {
                    let reminderDay = occurrence.adding(days: -offset)
                    guard reminderDay >= today, reminderDay <= windowEnd else { continue }
                    let when = phrasing.relative(from: reminderDay, to: occurrence)
                    let title = date.category == .careful ? "A date to keep in mind" : "\(person.name): \(date.label)"
                    let body = date.category == .careful ? "For \(person.name), \(when)." : "\(date.label) is \(when)."
                    add(.dateReminder, key: "date|\(date.id)|\(occurrence.isoString)|\(offset)", trigger: .floating(reminderDay, date.reminderTime), detailTitle: title, detailBody: body, sensitive: date.isSensitive)
                }
            }
        }

        // Promise due reminders.
        for promise in snapshot.promises.values.sorted(by: { $0.id < $1.id }) where promise.status == .open && promise.confirmation == .confirmed {
            guard let due = promise.due, let person = promise.personIDs.compactMap(eligible).sorted(by: { $0.id < $1.id }).first else { continue }
            let trigger: NotificationTrigger
            switch due {
            case .day(let day):
                guard day >= today, day <= windowEnd else { continue }
                trigger = .floating(day, preferences.digestTime)
            case .time(let date):
                guard date > context.now, CalendarDay(date: date, timeZone: context.timeZone) <= windowEnd else { continue }
                trigger = .absolute(date)
            }
            add(.promiseDue, key: "promise|\(promise.id)|\(due)", trigger: trigger, detailTitle: "For \(person.name)", detailBody: promise.description, sensitive: false)
        }

        // Meeting briefs before selected events.
        var seenOccurrences = Set<String>()
        for link in snapshot.calendarLinks.values.sorted(by: { $0.id < $1.id }) where link.status == .scheduled && link.attendance == .unknown {
            guard seenOccurrences.insert(link.occurrenceIdentity).inserted,
                  let person = link.personIDs.compactMap(eligible).sorted(by: { $0.id < $1.id }).first else { continue }
            let fire = link.startsAt.addingTimeInterval(-Double(meetingBriefLeadMinutes) * 60)
            guard CalendarDay(date: fire, timeZone: context.timeZone) <= windowEnd else { continue }
            add(.meetingBrief, key: "meeting|\(link.occurrenceIdentity)", trigger: .absolute(fire), detailTitle: "Before you see \(person.name)", detailBody: "A short brief is ready for your scheduled event.", sensitive: false, quiet: false)
        }

        // Snoozed cards come back as an explicit reminder at the absolute snooze time.
        for record in snapshot.suggestions.values.sorted(by: { $0.occurrenceKey < $1.occurrenceKey }) where record.state == .snoozed {
            guard let until = record.snoozedUntil, let person = eligible(record.personID),
                  CalendarDay(date: until, timeZone: context.timeZone) <= windowEnd else { continue }
            add(.snoozedCard, key: "snooze|\(record.occurrenceKey)|\(Int(until.timeIntervalSince1970))", trigger: .absolute(until), detailTitle: "Reminder about \(person.name)", detailBody: "You asked to be reminded about this.", sensitive: isSensitive(record, in: snapshot))
        }

        // At most `maxDigestsPerDay` (default 1) digest per day for cards without explicit reminders.
        if preferences.maxDigestsPerDay > 0 && preferences.suggestionsEnabled {
            let explicitRules: Set<SuggestionRuleID> = [.dateUpcoming, .promiseDue, .followUpDue, .pinnedPromise, .meetingBrief]
            for offset in 0...windowDays {
                let day = today.adding(days: offset)
                let (digestDay, digestTime) = preferences.quietHours.adjust(day: day, time: preferences.digestTime)
                let instant = digestDay.date(at: digestTime, in: context.timeZone)
                guard instant > context.now else { continue }
                let dayContext = EvaluationContext(now: instant, timeZone: context.timeZone)
                let cards = engine.evaluate(snapshot, context: dayContext).visible.filter { !explicitRules.contains($0.ruleID) }
                guard !cards.isEmpty else { continue }
                let names = cards.filter { !$0.isSensitive }.compactMap { snapshot.people[$0.personID]?.name }
                let detailBody = names.isEmpty ? NotificationPlanner.genericBody : "Moments for \(Array(Set(names)).sorted().joined(separator: ", "))."
                add(.digest, key: "digest|\(digestDay.isoString)", trigger: .floating(digestDay, digestTime), detailTitle: "Today in LittleThings", detailBody: detailBody, sensitive: cards.contains(where: \.isSensitive), quiet: false)
            }
        }

        // Bounded window: keep the earliest, deterministic tie-break.
        let unique = Dictionary(planned.map { ($0.identifier, $0) }, uniquingKeysWith: { a, _ in a }).values
        return unique
            .sorted { ($0.trigger.fireDate(in: context.timeZone), $0.identifier) < ($1.trigger.fireDate(in: context.timeZone), $1.identifier) }
            .prefix(maxPending)
            .map { $0 }
    }

    func isSensitive(_ record: SuggestionRecord, in snapshot: VaultSnapshot) -> Bool {
        record.evidence.contains { ref in
            if case .importantDate(let id) = ref { return snapshot.importantDates[id]?.isSensitive ?? false }
            if case .lifeEvent(let id) = ref { return snapshot.lifeEvents[id]?.isSensitive ?? false }
            return false
        }
    }

    /// Opaque identifier derived from the notification's key, time and content. Changing any
    /// of them produces a new identifier, so reconciliation replaces stale notifications.
    static func identifier(kind: PlannedNotificationKind, key: String, trigger: NotificationTrigger, title: String, body: String) -> String {
        let triggerKey: String
        switch trigger {
        case .floating(let day, let time): triggerKey = "f\(day.isoString)T\(time)"
        case .absolute(let date): triggerKey = "a\(Int(date.timeIntervalSince1970))"
        }
        let digest = SHA256.hash(data: Data("\(kind.rawValue)|\(key)|\(triggerKey)|\(title)|\(body)".utf8))
        return identifierPrefix + digest.prefix(12).map { String(format: "%02x", $0) }.joined()
    }

    /// Diff between desired and pending notifications. Applying it twice is a no-op.
    public static func reconcile(desired: [PlannedNotification], pendingIdentifiers: [String], authorization: NotificationAuthorization) -> (add: [PlannedNotification], remove: [String]) {
        let ours = Set(pendingIdentifiers.filter { $0.hasPrefix(identifierPrefix) })
        guard authorization == .authorized || authorization == .provisional else {
            return ([], ours.sorted())
        }
        let desiredIDs = Set(desired.map(\.identifier))
        let add = desired.filter { !ours.contains($0.identifier) }
        let remove = ours.subtracting(desiredIDs).sorted()
        return (add, remove)
    }
}
