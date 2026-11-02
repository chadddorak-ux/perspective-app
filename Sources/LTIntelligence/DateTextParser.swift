import Foundation
import LTDomain

/// How a date was determined from text.
public enum DateInterpretation: Hashable, Sendable {
    /// Fully stated, e.g. "December 12, 2026" or "2026-12-12".
    case explicit
    /// Month and day stated; the year was taken as the next occurrence after capture.
    case inferredYear
    /// Relative phrase ("next Friday", "tomorrow") resolved against the capture date.
    case relativeToCapture(String)
    /// Numeric form that could be read two ways (e.g. 3/4); resolved with the locale's order.
    case ambiguousNumeric

    /// Anything other than a fully explicit date needs the user's confirmation.
    public var needsConfirmation: Bool { self != .explicit }
}

public struct DateMatch: Hashable, Sendable {
    public var text: String
    /// Month/day (and year if stated) as written.
    public var month: Int
    public var day: Int
    public var statedYear: Int?
    /// Concrete day after resolving relative phrases or an unstated year.
    public var resolvedDay: CalendarDay
    public var interpretation: DateInterpretation
}

/// Deterministic date finder. Never invents a date: no match means no date.
public struct DateTextParser: Sendable {
    public var monthFirstNumeric: Bool

    public init(monthFirstNumeric: Bool = true) {
        self.monthFirstNumeric = monthFirstNumeric
    }

    static let months: [(String, Int)] = [
        ("january", 1), ("february", 2), ("march", 3), ("april", 4), ("may", 5), ("june", 6),
        ("july", 7), ("august", 8), ("september", 9), ("october", 10), ("november", 11), ("december", 12),
        ("jan", 1), ("feb", 2), ("mar", 3), ("apr", 4), ("jun", 6), ("jul", 7), ("aug", 8),
        ("sept", 9), ("sep", 9), ("oct", 10), ("nov", 11), ("dec", 12),
    ]

    static let weekdays: [(String, Int)] = [
        ("sunday", 1), ("monday", 2), ("tuesday", 3), ("wednesday", 4), ("thursday", 5), ("friday", 6), ("saturday", 7),
    ]

    public func matches(in text: String, captureDay: CalendarDay) -> [DateMatch] {
        var results: [DateMatch] = []
        let lower = text.lowercased()
        let monthAlternation = DateTextParser.months.map(\.0).sorted { $0.count > $1.count }.joined(separator: "|")

        // ISO: 2026-12-12
        for m in regexMatches(#"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"#, in: lower) {
            if let y = Int(m[1]), let mo = Int(m[2]), let d = Int(m[3]), let day = CalendarDay(year: y, month: mo, day: d) {
                results.append(DateMatch(text: m[0], month: mo, day: d, statedYear: y, resolvedDay: day, interpretation: .explicit))
            }
        }
        // "December 12", "Dec 12th", "December 12, 2026"
        for m in regexMatches(#"\b("# + monthAlternation + #")\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b"#, in: lower) {
            guard let month = DateTextParser.monthNumber(m[1]), let d = Int(m[2]) else { continue }
            let year = m[3].isEmpty ? nil : Int(m[3])
            if let match = makeMatch(text: m[0], month: month, day: d, year: year, captureDay: captureDay) { results.append(match) }
        }
        // "12 December", "12th of December 2026"
        for m in regexMatches(#"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?("# + monthAlternation + #")\b\.?(?:,?\s+(\d{4}))?"#, in: lower) {
            guard let month = DateTextParser.monthNumber(m[2]), let d = Int(m[1]) else { continue }
            let year = m[3].isEmpty ? nil : Int(m[3])
            if let match = makeMatch(text: m[0], month: month, day: d, year: year, captureDay: captureDay) { results.append(match) }
        }
        // Numeric 12/12 or 3/4/2027
        for m in regexMatches(#"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b"#, in: lower) {
            guard let a = Int(m[1]), let b = Int(m[2]) else { continue }
            var year = m[3].isEmpty ? nil : Int(m[3])
            if let y = year, y < 100 { year = 2000 + y }
            let ambiguous = a != b && a <= 12 && b <= 12
            let (month, day): (Int, Int)
            if a > 12 { (month, day) = (b, a) } else if b > 12 { (month, day) = (a, b) } else { (month, day) = monthFirstNumeric ? (a, b) : (b, a) }
            guard var match = makeMatch(text: m[0], month: month, day: day, year: year, captureDay: captureDay) else { continue }
            if ambiguous { match.interpretation = .ambiguousNumeric }
            results.append(match)
        }
        // Relative phrases
        if let r = lower.range(of: #"\btoday\b"#, options: .regularExpression) {
            results.append(relative(String(lower[r]), captureDay))
        }
        if let r = lower.range(of: #"\btomorrow\b"#, options: .regularExpression) {
            results.append(relative(String(lower[r]), captureDay.adding(days: 1)))
        }
        for (name, weekday) in DateTextParser.weekdays {
            for m in regexMatches(#"\b(next|this|on)?\s*"# + name + #"\b"#, in: lower) {
                // Upcoming occurrence ("this Friday" may be today). "Next Friday" is genuinely
                // ambiguous in English, which is why every relative match needs confirmation.
                let delta = (weekday - captureDay.weekday + 7) % 7
                let resolved = (delta == 0 && m[1] != "this") ? 7 : delta
                results.append(relative(m[0].trimmed, captureDay.adding(days: resolved)))
            }
        }
        for m in regexMatches(#"\bin\s+(\d+|one|two|three|four)\s+(day|days|week|weeks)\b"#, in: lower) {
            let words = ["one": 1, "two": 2, "three": 3, "four": 4]
            guard let n = Int(m[1]) ?? words[m[1]] else { continue }
            let days = m[2].hasPrefix("week") ? n * 7 : n
            results.append(relative(m[0], captureDay.adding(days: days)))
        }
        // Prefer explicit over overlapping weaker matches, keep text order.
        var seen = Set<String>()
        return results.filter { seen.insert($0.text).inserted }
    }

    func relative(_ text: String, _ day: CalendarDay) -> DateMatch {
        DateMatch(text: text, month: day.month, day: day.day, statedYear: nil, resolvedDay: day, interpretation: .relativeToCapture(text))
    }

    func makeMatch(text: String, month: Int, day: Int, year: Int?, captureDay: CalendarDay) -> DateMatch? {
        if let year {
            guard let resolved = CalendarDay(year: year, month: month, day: day) else { return nil }
            return DateMatch(text: text, month: month, day: day, statedYear: year, resolvedDay: resolved, interpretation: .explicit)
        }
        guard let annual = AnnualDate(month: month, day: day) else { return nil }
        // Next occurrence on or after capture (Feb 29 resolves to the next leap year).
        for y in captureDay.year...(captureDay.year + 8) {
            if let candidate = annual.observedDay(inYear: y, leapDayPolicy: nil), candidate >= captureDay {
                return DateMatch(text: text, month: month, day: day, statedYear: nil, resolvedDay: candidate, interpretation: .inferredYear)
            }
        }
        return nil
    }

    static func monthNumber(_ token: String) -> Int? {
        months.first { $0.0 == token.lowercased() }?.1
    }
}

/// Returns capture groups for every match; missing groups are "".
func regexMatches(_ pattern: String, in text: String) -> [[String]] {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
    let ns = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { result in
        (0..<result.numberOfRanges).map { i in
            let range = result.range(at: i)
            return range.location == NSNotFound ? "" : ns.substring(with: range)
        }
    }
}
