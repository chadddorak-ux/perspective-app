import Foundation

/// A date-only value (no time, no time zone). Birthdays, anniversaries and due days are
/// stored this way and are interpreted in the user's *current* time zone at evaluation
/// time, so a birthday stays on the same calendar day when the user travels.
///
/// Day arithmetic uses integer civil-calendar math (proleptic Gregorian), which is
/// independent of time zones and daylight saving.
public struct CalendarDay: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    public let year: Int
    public let month: Int
    public let day: Int

    public init?(year: Int, month: Int, day: Int) {
        guard (1...12).contains(month), day >= 1, day <= CalendarDay.daysInMonth(year: year, month: month) else {
            return nil
        }
        self.year = year
        self.month = month
        self.day = day
    }

    /// Creates a day from a value already known to be valid. Traps on invalid input.
    public init(_ year: Int, _ month: Int, _ day: Int) {
        guard let value = CalendarDay(year: year, month: month, day: day) else {
            preconditionFailure("Invalid calendar day \(year)-\(month)-\(day)")
        }
        self = value
    }

    /// Days since 1970-01-01.
    public init(dayNumber: Int) {
        let (y, m, d) = CalendarDay.civilFromDays(dayNumber)
        self.year = y
        self.month = m
        self.day = d
    }

    /// The calendar day containing `date` in `timeZone` (Gregorian).
    public init(date: Date, timeZone: TimeZone) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(components.year!, components.month!, components.day!)
    }

    public var dayNumber: Int { CalendarDay.daysFromCivil(year, month, day) }

    public func adding(days: Int) -> CalendarDay { CalendarDay(dayNumber: dayNumber + days) }

    /// Signed number of days from `self` to `other` (positive when `other` is later).
    public func days(until other: CalendarDay) -> Int { other.dayNumber - dayNumber }

    /// 1 = Sunday ... 7 = Saturday, matching `Calendar.component(.weekday, ...)`.
    public var weekday: Int {
        // 1970-01-01 was a Thursday (weekday 5).
        let value = (dayNumber % 7 + 7) % 7 // 0 = Thursday
        return (value + 4) % 7 + 1
    }

    /// Absolute instant for this day at a local wall-clock time in `timeZone`.
    /// If the wall-clock time does not exist (DST gap) Foundation moves it forward.
    public func date(at time: TimeOfDay, in timeZone: TimeZone) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = time.hour
        components.minute = time.minute
        return calendar.date(from: components)!
    }

    public func startOfDay(in timeZone: TimeZone) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.startOfDay(for: date(at: TimeOfDay(hour: 12, minute: 0), in: timeZone))
    }

    public var isoString: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    public init?(isoString: String) {
        let parts = isoString.split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else {
            return nil
        }
        self.init(year: y, month: m, day: d)
    }

    public var description: String { isoString }

    public static func < (lhs: CalendarDay, rhs: CalendarDay) -> Bool { lhs.dayNumber < rhs.dayNumber }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        guard let value = CalendarDay(isoString: string) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid calendar day")
        }
        self = value
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(isoString)
    }

    public static func isLeapYear(_ year: Int) -> Bool {
        (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
    }

    public static func daysInMonth(year: Int, month: Int) -> Int {
        switch month {
        case 1, 3, 5, 7, 8, 10, 12: return 31
        case 4, 6, 9, 11: return 30
        case 2: return isLeapYear(year) ? 29 : 28
        default: return 0
        }
    }

    // Howard Hinnant's civil-from-days algorithms.
    static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (m + 9) % 12
        let doy = (153 * mp + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    static func civilFromDays(_ z0: Int) -> (Int, Int, Int) {
        let z = z0 + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (y + (m <= 2 ? 1 : 0), m, d)
    }
}

/// A local wall-clock time without a date.
public struct TimeOfDay: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    public var hour: Int
    public var minute: Int

    public init(hour: Int, minute: Int = 0) {
        precondition((0...23).contains(hour) && (0...59).contains(minute), "Invalid time of day")
        self.hour = hour
        self.minute = minute
    }

    public init(date: Date, timeZone: TimeZone) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.hour, .minute], from: date)
        self.init(hour: c.hour!, minute: c.minute!)
    }

    public var minutesSinceMidnight: Int { hour * 60 + minute }
    public var description: String { String(format: "%02d:%02d", hour, minute) }

    public static func < (lhs: TimeOfDay, rhs: TimeOfDay) -> Bool {
        lhs.minutesSinceMidnight < rhs.minutesSinceMidnight
    }

    public static let morning = TimeOfDay(hour: 9)
    public static let evening = TimeOfDay(hour: 19)
}

/// Quiet hours, possibly wrapping past midnight (e.g. 21:30–08:00).
public struct QuietHours: Hashable, Codable, Sendable {
    public var isEnabled: Bool
    public var start: TimeOfDay
    public var end: TimeOfDay

    public init(isEnabled: Bool = true, start: TimeOfDay = TimeOfDay(hour: 21, minute: 30), end: TimeOfDay = TimeOfDay(hour: 8)) {
        self.isEnabled = isEnabled
        self.start = start
        self.end = end
    }

    public func contains(_ time: TimeOfDay) -> Bool {
        guard isEnabled, start != end else { return false }
        if start < end {
            return time >= start && time < end
        }
        return time >= start || time < end
    }

    /// Moves a fire time out of quiet hours to the end of the quiet period.
    /// Returns the (possibly next) day and time to use.
    public func adjust(day: CalendarDay, time: TimeOfDay) -> (CalendarDay, TimeOfDay) {
        guard contains(time) else { return (day, time) }
        if start < end || time < end {
            return (day, end)
        }
        // Inside the part of the window before midnight: move to tomorrow's end.
        return (day.adding(days: 1), end)
    }
}

/// How to observe a February 29 date in a non-leap year. The user must choose; there is no
/// silent default (FR3).
public enum LeapDayPolicy: String, Codable, Sendable, CaseIterable {
    case february28
    case march1
}

/// A recurring month/day with an optional origin year (for example a birth year).
public struct AnnualDate: Hashable, Codable, Sendable {
    public var month: Int
    public var day: Int
    public var year: Int?

    public init?(month: Int, day: Int, year: Int? = nil) {
        // Validate against a leap year so Feb 29 is accepted.
        guard CalendarDay(year: 2000, month: month, day: day) != nil else { return nil }
        if let year, CalendarDay(year: year, month: month, day: day) == nil { return nil }
        self.month = month
        self.day = day
        self.year = year
    }

    public var isLeapDay: Bool { month == 2 && day == 29 }

    /// The day this date is observed in `year`, or `nil` when it is February 29 in a
    /// non-leap year and the user has not chosen how to observe it.
    public func observedDay(inYear year: Int, leapDayPolicy: LeapDayPolicy?) -> CalendarDay? {
        if let exact = CalendarDay(year: year, month: month, day: day) {
            return exact
        }
        guard isLeapDay else { return nil }
        switch leapDayPolicy {
        case .february28: return CalendarDay(year, 2, 28)
        case .march1: return CalendarDay(year, 3, 1)
        case nil: return nil
        }
    }
}

/// Source of the current time. Inject a fixed clock in tests.
public protocol WallClock: Sendable {
    var now: Date { get }
}

public struct SystemWallClock: WallClock {
    public init() {}
    public var now: Date { Date() }
}

/// Evaluation context shared by rules: the instant and the user's current time zone.
public struct EvaluationContext: Sendable, Hashable {
    public var now: Date
    public var timeZone: TimeZone

    public init(now: Date, timeZone: TimeZone) {
        self.now = now
        self.timeZone = timeZone
    }

    public var today: CalendarDay { CalendarDay(date: now, timeZone: timeZone) }
    public var timeOfDay: TimeOfDay { TimeOfDay(date: now, timeZone: timeZone) }
}
