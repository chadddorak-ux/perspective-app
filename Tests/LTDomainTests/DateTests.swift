import Foundation
import Testing
@testable import LTDomain
import LTTestSupport

@Suite("Calendar days and recurrence (FR3)")
struct DateTests {
    @Test func civilRoundTripAcrossCenturies() {
        for n in stride(from: -200_000, through: 200_000, by: 997) {
            let day = CalendarDay(dayNumber: n)
            #expect(day.dayNumber == n)
            #expect(CalendarDay(year: day.year, month: day.month, day: day.day) == day)
        }
    }

    @Test func knownWeekdays() {
        #expect(CalendarDay(2026, 11, 2).weekday == 2) // Monday
        #expect(CalendarDay(1970, 1, 1).weekday == 5) // Thursday
        #expect(CalendarDay(2000, 2, 29).weekday == 3) // Tuesday
    }

    @Test func leapDayValidation() {
        #expect(CalendarDay(year: 2028, month: 2, day: 29) != nil)
        #expect(CalendarDay(year: 2027, month: 2, day: 29) == nil)
        #expect(CalendarDay(year: 1900, month: 2, day: 29) == nil)
        #expect(CalendarDay(year: 2000, month: 2, day: 29) != nil)
        #expect(AnnualDate(month: 2, day: 29) != nil)
        #expect(AnnualDate(month: 2, day: 29, year: 2027) == nil)
        #expect(AnnualDate(month: 2, day: 30) == nil)
    }

    @Test func dayArithmeticCrossesYearBoundary() {
        let dec31 = CalendarDay(2026, 12, 31)
        #expect(dec31.adding(days: 1) == CalendarDay(2027, 1, 1))
        #expect(dec31.days(until: CalendarDay(2027, 1, 5)) == 5)
        #expect(CalendarDay(2027, 3, 1).adding(days: -1) == CalendarDay(2027, 2, 28))
        #expect(CalendarDay(2028, 3, 1).adding(days: -1) == CalendarDay(2028, 2, 29))
    }

    @Test func isoCoding() throws {
        let day = CalendarDay(2026, 2, 3)
        let data = try JSONEncoder().encode(day)
        #expect(String(decoding: data, as: UTF8.self) == "\"2026-02-03\"")
        #expect(try JSONDecoder().decode(CalendarDay.self, from: data) == day)
        #expect(throws: DecodingError.self) { try JSONDecoder().decode(CalendarDay.self, from: Data("\"2026-02-30\"".utf8)) }
    }

    @Test func wallClockTimesAcrossDaylightSavingEnd() {
        // DST ends in New York on Sunday 2026-11-01.
        let before = CalendarDay(2026, 10, 31).date(at: TimeOfDay(hour: 9), in: TestDates.newYork)
        let after = CalendarDay(2026, 11, 1).date(at: TimeOfDay(hour: 9), in: TestDates.newYork)
        #expect(after.timeIntervalSince(before) == 25 * 3600)
        #expect(TimeOfDay(date: after, timeZone: TestDates.newYork) == TimeOfDay(hour: 9))
    }

    @Test func wallClockTimeInSpringForwardGapStillResolves() {
        // 02:30 does not exist on 2027-03-14 in New York; Foundation moves forward.
        let date = CalendarDay(2027, 3, 14).date(at: TimeOfDay(hour: 2, minute: 30), in: TestDates.newYork)
        #expect(CalendarDay(date: date, timeZone: TestDates.newYork) == CalendarDay(2027, 3, 14))
    }

    @Test func calendarDayFollowsTimeZone() {
        // 2026-11-02 03:00 UTC is still Nov 1 in New York but Nov 2 in Tokyo.
        let instant = CalendarDay(2026, 11, 2).date(at: TimeOfDay(hour: 3), in: TestDates.utc)
        #expect(CalendarDay(date: instant, timeZone: TestDates.newYork) == CalendarDay(2026, 11, 1))
        #expect(CalendarDay(date: instant, timeZone: TimeZone(identifier: "Asia/Tokyo")!) == CalendarDay(2026, 11, 2))
    }

    @Test func leapDayRequiresExplicitChoice() {
        let annual = AnnualDate(month: 2, day: 29)!
        #expect(annual.observedDay(inYear: 2028, leapDayPolicy: nil) == CalendarDay(2028, 2, 29))
        #expect(annual.observedDay(inYear: 2027, leapDayPolicy: nil) == nil)
        #expect(annual.observedDay(inYear: 2027, leapDayPolicy: .february28) == CalendarDay(2027, 2, 28))
        #expect(annual.observedDay(inYear: 2027, leapDayPolicy: .march1) == CalendarDay(2027, 3, 1))

        let person = PersonID()
        var date = ImportantDate(personID: person, category: .birthday, schedule: .annual(annual), createdAt: Date())
        #expect(date.needsLeapDayChoice)
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2027, 1, 1)) == CalendarDay(2028, 2, 29))
        date.leapDayPolicy = .march1
        #expect(!date.needsLeapDayChoice)
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2027, 1, 1)) == CalendarDay(2027, 3, 1))
    }

    @Test func nextOccurrenceAcrossYearBoundary() {
        let date = ImportantDate(personID: PersonID(), category: .birthday, schedule: .annual(AnnualDate(month: 1, day: 5)!), createdAt: Date())
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2026, 12, 31)) == CalendarDay(2027, 1, 5))
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2027, 1, 5)) == CalendarDay(2027, 1, 5))
        #expect(date.occurrences(from: CalendarDay(2026, 12, 20), through: CalendarDay(2028, 1, 10)) == [CalendarDay(2027, 1, 5), CalendarDay(2028, 1, 5)])
    }

    @Test func ageOnlyWithBirthYear() {
        let withYear = ImportantDate(personID: PersonID(), category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 10, year: 1990)!), createdAt: Date())
        let withoutYear = ImportantDate(personID: PersonID(), category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 10)!), createdAt: Date())
        let anniversary = ImportantDate(personID: PersonID(), category: .anniversary, schedule: .annual(AnnualDate(month: 6, day: 1, year: 2015)!), createdAt: Date())
        #expect(withYear.age(on: CalendarDay(2026, 11, 10)) == 36)
        #expect(withoutYear.age(on: CalendarDay(2026, 11, 10)) == nil)
        #expect(anniversary.age(on: CalendarDay(2026, 6, 1)) == nil)
    }

    @Test func completingOneOccurrenceKeepsFutureOnes() {
        var date = ImportantDate(personID: PersonID(), category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 10)!), createdAt: Date())
        date.completedOccurrences.insert(CalendarDay(2026, 11, 10))
        #expect(date.isCompleted(CalendarDay(2026, 11, 10)))
        #expect(!date.isCompleted(CalendarDay(2027, 11, 10)))
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2026, 11, 11)) == CalendarDay(2027, 11, 10))
    }

    @Test func oneTimeMilestoneHasNoFutureRecurrence() {
        let date = ImportantDate(personID: PersonID(), category: .milestone, schedule: .once(CalendarDay(2026, 12, 12)), createdAt: Date())
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2026, 11, 2)) == CalendarDay(2026, 12, 12))
        #expect(date.nextOccurrence(onOrAfter: CalendarDay(2026, 12, 13)) == nil)
    }

    @Test func carefulDatesDefaultToPrivateAndOff() {
        let date = ImportantDate(personID: PersonID(), category: .careful, schedule: .annual(AnnualDate(month: 3, day: 3)!), createdAt: Date())
        #expect(date.isSensitive)
        #expect(!date.remindersEnabled)
        #expect(!date.category.isCelebratory)
        let birthday = ImportantDate(personID: PersonID(), category: .birthday, schedule: .annual(AnnualDate(month: 3, day: 3)!), createdAt: Date())
        #expect(birthday.reminderOffsetsDays == [14, 0])
        #expect(birthday.remindersEnabled)
    }

    @Test func quietHoursWrapPastMidnight() {
        let quiet = QuietHours(start: TimeOfDay(hour: 21, minute: 30), end: TimeOfDay(hour: 8))
        #expect(quiet.contains(TimeOfDay(hour: 23)))
        #expect(quiet.contains(TimeOfDay(hour: 7, minute: 59)))
        #expect(!quiet.contains(TimeOfDay(hour: 8)))
        #expect(!quiet.contains(TimeOfDay(hour: 12)))
        let day = CalendarDay(2026, 11, 2)
        #expect(quiet.adjust(day: day, time: TimeOfDay(hour: 22)) == (day.adding(days: 1), TimeOfDay(hour: 8)))
        #expect(quiet.adjust(day: day, time: TimeOfDay(hour: 6)) == (day, TimeOfDay(hour: 8)))
        #expect(quiet.adjust(day: day, time: TimeOfDay(hour: 9)) == (day, TimeOfDay(hour: 9)))
        #expect(!QuietHours(isEnabled: false).contains(TimeOfDay(hour: 23)))
    }

    @Test func undatedPromiseNeverOverdue() {
        let context = EvaluationContext(now: TestDates.fixtureNow, timeZone: TestDates.newYork)
        let undated = Promise(personIDs: [PersonID()], description: "Send book", createdAt: Date(timeIntervalSince1970: 0))
        #expect(!undated.isOverdue(in: context))
        var dated = undated
        dated.due = .day(CalendarDay(2026, 11, 1))
        #expect(dated.isOverdue(in: context))
        dated.status = .done
        #expect(!dated.isOverdue(in: context))
    }
}
