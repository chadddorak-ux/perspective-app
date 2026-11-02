import Foundation
import LTDomain

/// Synthetic demo people, relative to "now", every record flagged `isDemo`. The demo runs in
/// its own throwaway vault and is never mixed with real records.
public enum DemoContent {
    public static func make(now: Date, timeZone: TimeZone) -> VaultSnapshot {
        let today = CalendarDay(date: now, timeZone: timeZone)
        let created = now.addingTimeInterval(-45 * 86_400)
        var s = VaultSnapshot()
        s.preferences = Preferences(onboardingCompleted: true)

        func person(_ name: String, _ label: String, city: String? = nil, phone: String? = nil, cadence: Int? = nil, observed: Bool = false) -> Person {
            Person(displayName: name, relationshipLabel: label, phoneNumbers: phone.map { [LabeledValue(label: "mobile", value: $0)] } ?? [], city: city, reminderPreferences: ReminderPreferences(cadenceDays: cadence, observedPatternEnabled: observed), isDemo: true, createdAt: created)
        }
        let sam = person("Sam Rivera (Demo)", "Friend", city: "Chicago", phone: "+1 555 010 0001")
        let jeff = person("Jeff Park (Demo)", "Friend", city: "Seattle", phone: "+1 555 010 0002", cadence: 21)
        let maya = person("Maya Chen (Demo)", "Cousin", phone: "+1 555 010 0003")
        let alex = person("Alex Morgan (Demo)", "Friend", city: "Chicago", phone: "+1 555 010 0004")
        let rachel = person("Rachel Adams (Demo)", "Friend", phone: "+1 555 010 0005")
        for p in [sam, jeff, maya, alex, rachel] { s.people[p.id] = p }

        let samNote = Source(kind: .manualNote, capturedAt: now.addingTimeInterval(-12 * 86_400), text: "Sam got the team lead job at Northwind. He starts \(monthDay(today)). He was excited about managing a team.", personIDs: [sam.id], isDemo: true)
        s.sources[samNote.id] = samNote
        let excitedFact = Fact(personID: sam.id, category: .work, label: "About the new role", value: "Excited about managing a team", sourceID: samNote.id, excerpt: "He was excited about managing a team.", state: .confirmed, origin: .extracted, createdAt: samNote.capturedAt)
        s.facts[excitedFact.id] = excitedFact
        let newJob = LifeEvent(personID: sam.id, category: .newJob, summary: "Starts as team lead at Northwind", sourceIDs: [samNote.id], excerpt: "He starts \(monthDay(today)).", eventDay: today, capturedAt: samNote.capturedAt, confirmation: .confirmed, createdAt: samNote.capturedAt)
        s.lifeEvents[newJob.id] = newJob

        let lastCall = Interaction(personIDs: [jeff.id], kind: .call, occurredAt: now.addingTimeInterval(-25 * 86_400), confirmation: .userConfirmed, summary: "Long call about his trip", createdAt: now.addingTimeInterval(-25 * 86_400))
        s.interactions[lastCall.id] = lastCall

        let birthdayDay = today.adding(days: 8)
        let birthday = ImportantDate(personID: maya.id, category: .birthday, schedule: .annual(AnnualDate(month: birthdayDay.month, day: birthdayDay.day)!), createdAt: created)
        s.importantDates[birthday.id] = birthday
        let gift = GiftIdea(personID: maya.id, title: "Watercolor travel set", budget: Money(minorUnits: 4_000, currencyCode: "USD"), occasionDateID: birthday.id, createdAt: created)
        s.gifts[gift.id] = gift

        let alexNote = Source(kind: .manualNote, capturedAt: now.addingTimeInterval(-3 * 86_400), text: "Alex's daughter is Maya. Her recital is \(monthDay(today.adding(days: 40))). I promised to send him the photographer's number.", personIDs: [alex.id], isDemo: true)
        s.sources[alexNote.id] = alexNote
        let promise = Promise(personIDs: [alex.id], description: "Send Alex the photographer's number", due: .day(today.adding(days: 1)), sourceID: alexNote.id, excerpt: "I promised to send him the photographer's number.", createdAt: alexNote.capturedAt)
        s.promises[promise.id] = promise

        let carefulDay = today.adding(days: 2)
        let careful = ImportantDate(personID: rachel.id, category: .careful, label: "Anniversary of a loss", schedule: .annual(AnnualDate(month: carefulDay.month, day: carefulDay.day)!), reminderOffsetsDays: [3, 0], remindersEnabled: true, createdAt: created)
        s.importantDates[careful.id] = careful

        let trip = Trip(city: "Chicago", startDay: today.adding(days: 9), endDay: today.adding(days: 11), createdAt: now)
        s.trips[trip.id] = trip
        return s
    }

    static func monthDay(_ day: CalendarDay) -> String {
        let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        return "\(months[day.month - 1]) \(day.day)"
    }
}
