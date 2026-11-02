import Foundation
import LTDomain

/// Tunable windows for the deterministic P0 rules.
public struct RuleParameters: Hashable, Sendable {
    /// Days after a date occurrence that its card stays available (covers missed device runs).
    public var dateGraceDays: Int = 2
    /// Promises due within this many days appear; overdue ones stay until resolved.
    public var promiseLeadDays: Int = 2
    public var meetingBriefLeadHours: Int = 24
    public var meetingFollowUpDays: Int = 3
    public var lifeUpdateRecencyDays: Int = 7
    public var lifeUpdateLeadDays: Int = 1
    public var travelLeadDays: Int = 14
    public var minimumGiftPlanningDays: Int = 3

    public init() {}
}

/// Generates candidate cards. Pure: same snapshot + context ⇒ same candidates.
struct RuleSet {
    let snapshot: VaultSnapshot
    let context: EvaluationContext
    let parameters: RuleParameters
    let phrasing: DayPhrasing

    var today: CalendarDay { context.today }

    func person(_ id: PersonID) -> Person? {
        guard let person = snapshot.people[id], person.isEligibleForSuggestions else { return nil }
        return person
    }

    func allCandidates() -> [SuggestionCard] {
        dateCards() + promiseCards() + meetingCards() + cadenceCards() + rhythmCards() + lifeUpdateCards() + travelCards()
    }

    // MARK: Dates (FR3)

    func dateCards() -> [SuggestionCard] {
        var cards: [SuggestionCard] = []
        for date in snapshot.importantDates.values {
            guard let person = person(date.personID), !date.isPaused, date.remindersEnabled,
                  date.confirmation == .confirmed else { continue }
            let lead = date.reminderOffsetsDays.max() ?? 0
            let windowStart = today.adding(days: -parameters.dateGraceDays)
            let windowEnd = today.adding(days: max(lead, 0))
            for occurrence in date.occurrences(from: windowStart, through: windowEnd) where !date.isCompleted(occurrence) {
                cards.append(dateCard(date, person: person, occurrence: occurrence, lead: lead))
            }
        }
        return cards
    }

    func dateCard(_ date: ImportantDate, person: Person, occurrence: CalendarDay, lead: Int) -> SuggestionCard {
        let when = phrasing.relative(from: today, to: occurrence)
        let daysUntil = today.days(until: occurrence)
        let isPast = daysUntil < 0
        let name = person.name
        let title: String
        var actions: [CardAction] = [.review]
        var detail: String?
        switch date.category {
        case .birthday:
            if let age = date.age(on: occurrence), !isPast {
                title = daysUntil == 0 ? "\(name) turns \(age) today" : "\(name) turns \(age) \(when)"
            } else {
                title = isPast ? "\(name)'s birthday was \(when)" : "\(name)'s birthday is \(when)"
            }
        case .anniversary:
            title = isPast ? "\(name)'s \(date.label.lowercased()) was \(when)" : "\(name)'s \(date.label.lowercased()) is \(when)"
        case .milestone, .customAnnual:
            title = isPast ? "\(name): \(date.label) was \(when)" : "\(name): \(date.label) is \(when)"
        case .careful:
            // Gentle and never celebratory.
            title = "A date to keep in mind for \(name) is \(when)"
            detail = date.label
        }
        if date.category.isCelebratory {
            actions.append(.draftMessage)
            let ideas = giftIdeas(for: person.id)
            if (date.category == .birthday || date.category == .anniversary), daysUntil >= parameters.minimumGiftPlanningDays {
                actions.append(.planGift)
            }
            if let idea = ideas.first {
                detail = "You saved a gift idea: \(idea.title)."
            }
        } else {
            actions.append(.draftMessage)
        }
        actions += [.remindTonight, .snooze, .dismiss, .done]
        let reason: String
        if isPast {
            reason = "This date was \(when) and hasn't been marked done."
        } else if date.category == .careful {
            reason = "You asked to be reminded about this date."
        } else {
            reason = "This date is within your \(lead)-day planning window."
        }
        var items = [ExplanationItem(label: date.label, text: phrasing.monthDay(occurrence) + (date.age(on: occurrence) == nil && date.category == .birthday ? " (birth year not saved)" : ""), evidence: .importantDate(date.id))]
        items += sourceItems(date.sourceID, excerpt: date.excerpt)
        return SuggestionCard(
            occurrenceKey: "\(SuggestionRuleID.dateUpcoming.rawValue)|\(date.id)|\(occurrence.isoString)",
            ruleID: .dateUpcoming,
            personID: person.id,
            tier: .date,
            relevantAt: occurrence.startOfDay(in: context.timeZone),
            title: title,
            detail: detail,
            explanation: CardExplanation(reason: reason, items: items),
            evidence: [.importantDate(date.id)] + (date.sourceID.map { [.source($0)] } ?? []),
            actions: actions,
            isSensitive: date.isSensitive,
            allowsCelebration: date.category.isCelebratory && !date.isSensitive
        )
    }

    func giftIdeas(for personID: PersonID) -> [GiftIdea] {
        let given = Set(snapshot.gifts.values.filter { $0.personID == personID && $0.state == .given }.map(\.normalizedIdentity))
        return snapshot.gifts.values
            .filter { $0.personID == personID && ($0.state == .idea || $0.state == .planned) && !given.contains($0.normalizedIdentity) }
            .sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    // MARK: Promises and follow-ups (FR4)

    func promiseCards() -> [SuggestionCard] {
        var cards: [SuggestionCard] = []
        for promise in snapshot.promises.values where promise.status == .open && promise.confirmation == .confirmed {
            let people = promise.personIDs.compactMap(person).sorted { $0.id < $1.id }
            guard let primary = people.first else { continue }
            let names = people.map(\.name).joined(separator: " and ")
            if promise.isPinned {
                cards.append(promiseCard(promise, person: primary, names: names, rule: .pinnedPromise, key: "\(SuggestionRuleID.pinnedPromise.rawValue)|\(promise.id)", tier: .pinned, relevantAt: promise.createdAt, dueText: promise.due.map(dueText)))
                continue
            }
            guard let due = promise.due else { continue } // undated promises never surface on their own
            let dueDay = due.day(in: context.timeZone)
            guard today.days(until: dueDay) <= parameters.promiseLeadDays else { continue }
            let rule: SuggestionRuleID = promise.kind == .followUp ? .followUpDue : .promiseDue
            let relevant: Date
            switch due {
            case .day(let day): relevant = day.startOfDay(in: context.timeZone)
            case .time(let date): relevant = date
            }
            cards.append(promiseCard(promise, person: primary, names: names, rule: rule, key: "\(rule.rawValue)|\(promise.id)|\(dueKey(due))", tier: .commitment, relevantAt: relevant, dueText: dueText(due)))
        }
        return cards
    }

    func dueKey(_ due: PromiseDue) -> String {
        switch due {
        case .day(let day): return day.isoString
        case .time(let date): return String(Int(date.timeIntervalSince1970))
        }
    }

    func dueText(_ due: PromiseDue) -> String {
        let day = due.day(in: context.timeZone)
        let delta = today.days(until: day)
        if delta < 0 { return "Was due \(phrasing.monthDay(day))" }
        if case .time(let date) = due { return "Due \(phrasing.relative(from: today, to: day)) at \(phrasing.time(date))" }
        return "Due \(phrasing.relative(from: today, to: day))"
    }

    func promiseCard(_ promise: Promise, person: Person, names: String, rule: SuggestionRuleID, key: String, tier: CardTier, relevantAt: Date, dueText: String?) -> SuggestionCard {
        let title: String
        switch (promise.kind, promise.owner) {
        case (.followUp, _): title = promise.description
        case (.commitment, .me): title = "You promised \(names): \(promise.description)"
        case (.commitment, .person(let id)):
            let owner = snapshot.people[id]?.name ?? names
            title = "\(owner) offered: \(promise.description)"
        }
        var items = [ExplanationItem(label: promise.kind == .followUp ? "Follow-up" : "Promise", text: promise.description, date: promise.createdAt, evidence: .promise(promise.id))]
        items += sourceItems(promise.sourceID, excerpt: promise.excerpt)
        return SuggestionCard(
            occurrenceKey: key,
            ruleID: rule,
            personID: person.id,
            tier: tier,
            relevantAt: relevantAt,
            title: title,
            detail: dueText,
            explanation: CardExplanation(reason: tier == .pinned ? "You pinned this." : "This is open and \(dueText?.lowercased() ?? "has no date").", items: items),
            evidence: [.promise(promise.id)] + (promise.sourceID.map { [.source($0)] } ?? []),
            actions: [.review, .draftMessage, .remindTonight, .snooze, .dismiss, .done],
            isPinned: tier == .pinned
        )
    }

    // MARK: Meetings (FR6, FR15)

    func meetingCards() -> [SuggestionCard] {
        var byOccurrence: [String: [CalendarLink]] = [:]
        for link in snapshot.calendarLinks.values where link.status == .scheduled && link.attendance == .unknown {
            byOccurrence[link.occurrenceIdentity, default: []].append(link)
        }
        var cards: [SuggestionCard] = []
        for (identity, links) in byOccurrence {
            let sortedLinks = links.sorted { $0.id < $1.id }
            let link = sortedLinks[0]
            let people = Set(sortedLinks.flatMap(\.personIDs)).compactMap(person).sorted { $0.id < $1.id }
            guard let primary = people.first else { continue }
            let names = people.map(\.name).joined(separator: ", ")
            let label = link.title.map { "“\($0)”" } ?? "Scheduled event"
            let startDay = CalendarDay(date: link.startsAt, timeZone: context.timeZone)
            let evidence = sortedLinks.map { EvidenceRef.calendarLink($0.id) }
            if link.startsAt > context.now, link.startsAt.timeIntervalSince(context.now) <= Double(parameters.meetingBriefLeadHours) * 3600 {
                let when = "\(phrasing.relative(from: today, to: startDay)) at \(phrasing.time(link.startsAt))"
                cards.append(SuggestionCard(
                    occurrenceKey: "\(SuggestionRuleID.meetingBrief.rawValue)|\(identity)",
                    ruleID: .meetingBrief,
                    personID: primary.id,
                    tier: .meeting,
                    relevantAt: link.startsAt,
                    title: "Scheduled: \(label) with \(names) \(when)",
                    detail: "Open a short brief before you meet.",
                    explanation: CardExplanation(reason: "You linked this calendar event to \(names). It is a scheduled event, not a confirmed meeting.", items: [ExplanationItem(label: "Calendar", text: "\(label), \(phrasing.monthDay(startDay)) \(phrasing.time(link.startsAt))", date: link.lastRefreshedAt, evidence: .calendarLink(link.id))]),
                    evidence: evidence,
                    actions: [.openBrief, .snooze, .dismiss]
                ))
            } else if link.endsAt <= context.now, context.now.timeIntervalSince(link.endsAt) <= Double(parameters.meetingFollowUpDays) * 86_400 {
                cards.append(SuggestionCard(
                    occurrenceKey: "\(SuggestionRuleID.meetingFollowUp.rawValue)|\(identity)",
                    ruleID: .meetingFollowUp,
                    personID: primary.id,
                    tier: .meeting,
                    relevantAt: link.endsAt,
                    title: "Did \(label) with \(names) happen?",
                    detail: "Confirm before it's logged as time together.",
                    explanation: CardExplanation(reason: "A linked event ended \(phrasing.relative(from: today, to: CalendarDay(date: link.endsAt, timeZone: context.timeZone))). Planned events are never counted as attended without your confirmation.", items: [ExplanationItem(label: "Calendar", text: label, date: link.endsAt, evidence: .calendarLink(link.id))]),
                    evidence: evidence,
                    actions: [.confirmAttendance, .dismiss]
                ))
            }
        }
        return cards
    }

    // MARK: Cadence (FR5)

    func cadenceCards() -> [SuggestionCard] {
        var cards: [SuggestionCard] = []
        for person in snapshot.people.values where person.isEligibleForSuggestions {
            guard let cadence = person.reminderPreferences.cadenceDays, cadence > 0 else { continue }
            let interactions = snapshot.interactions.values.filter { $0.personIDs.contains(person.id) && $0.occurredAt <= context.now }
            guard let last = interactions.max(by: { ($0.occurredAt, $0.id) < ($1.occurredAt, $1.id) }) else {
                cards.append(SuggestionCard(
                    occurrenceKey: "\(SuggestionRuleID.cadenceBaseline.rawValue)|\(person.id)",
                    ruleID: .cadenceBaseline,
                    personID: person.id,
                    tier: .cadence,
                    relevantAt: person.updatedAt,
                    title: "When did you last catch up with \(person.name)?",
                    detail: "Add a starting point so check-in reminders are based on something real.",
                    explanation: CardExplanation(reason: "You chose a \(cadence)-day check-in rhythm, but there's no logged conversation yet.", items: []),
                    evidence: [.person(person.id)],
                    actions: [.setBaseline, .dismiss]
                ))
                continue
            }
            let lastDay = CalendarDay(date: last.occurredAt, timeZone: context.timeZone)
            guard lastDay.days(until: today) >= cadence else { continue }
            let title: String
            if last.confirmation == .userConfirmed {
                title = "You last logged a conversation with \(person.name) on \(phrasing.monthDay(lastDay)). Have you caught up since?"
            } else {
                let channel = channelName(last.channel)
                title = "The last conversation with \(person.name) in \(channel) was on \(phrasing.monthDay(lastDay)). Have you caught up since?"
            }
            cards.append(SuggestionCard(
                occurrenceKey: "\(SuggestionRuleID.cadenceCheck.rawValue)|\(person.id)|\(lastDay.isoString)",
                ruleID: .cadenceCheck,
                personID: person.id,
                tier: .cadence,
                relevantAt: lastDay.adding(days: cadence).startOfDay(in: context.timeZone),
                title: title,
                explanation: CardExplanation(reason: "You asked for a check-in about every \(cadence) days. This only counts conversations you logged or sources you connected.", items: [ExplanationItem(label: last.confirmation == .userConfirmed ? "Logged" : "Observed", text: last.summary ?? last.kind.rawValue.capitalized, date: last.occurredAt, evidence: .interaction(last.id))]),
                evidence: [.interaction(last.id)],
                actions: [.logCatchUp, .draftMessage, .snooze, .dismiss]
            ))
        }
        return cards
    }

    func channelName(_ channel: String?) -> String {
        guard let channel, let id = ConnectionID(uuidString: channel), let connection = snapshot.connections[id] else {
            return "a connected source"
        }
        return connection.displayName
    }

    // MARK: Rhythm (FR14)

    func rhythmCards() -> [SuggestionCard] {
        var cards: [SuggestionCard] = []
        for person in snapshot.people.values where person.reminderPreferences.observedPatternEnabled {
            guard case .lull(let finding) = RhythmAnalyzer.analyze(personID: person.id, in: snapshot, context: context, parameters: snapshot.preferences.rhythm) else { continue }
            let weeks = finding.quietDays / 7
            let span = weeks >= 2 ? "\(DayPhrasing.words(weeks)) weeks" : "\(finding.quietDays) days"
            let channels = finding.channelNames.joined(separator: ", ")
            let coverageStartDay = CalendarDay(date: finding.coverageStart, timeZone: context.timeZone)
            let refreshDay = CalendarDay(date: finding.lastRefresh, timeZone: context.timeZone)
            cards.append(SuggestionCard(
                occurrenceKey: "\(SuggestionRuleID.rhythmLull.rawValue)|\(person.id)|\(finding.lastObservedDay.isoString)",
                ruleID: .rhythmLull,
                personID: person.id,
                tier: .cadence,
                relevantAt: finding.lastObservedDay.adding(days: snapshot.preferences.rhythm.lullDays).startOfDay(in: context.timeZone),
                title: "You and \(person.name) were chatting regularly in the messages you connected. I haven't seen a conversation there in \(span). Want to check in?",
                explanation: CardExplanation(
                    reason: "\(finding.activeDaysInBaseline) active conversation days in the \(snapshot.preferences.rhythm.baselineWeeks) weeks before \(phrasing.monthDay(finding.lastObservedDay)), then \(finding.quietDays) days without one in that source. You may have talked elsewhere.",
                    items: [ExplanationItem(label: "Last observed", text: phrasing.monthDay(finding.lastObservedDay), evidence: .interaction(finding.lastObservedInteraction))],
                    coverage: "Covers \(channels) from \(phrasing.monthDay(coverageStartDay)) to \(phrasing.monthDay(refreshDay)); last refreshed \(phrasing.monthDay(refreshDay))."
                ),
                evidence: [.interaction(finding.lastObservedInteraction)],
                actions: [.logCatchUp, .draftMessage, .snooze, .dismiss]
            ))
        }
        return cards
    }

    // MARK: Life updates (FR13)

    func lifeUpdateCards() -> [SuggestionCard] {
        var groups: [String: [LifeEvent]] = [:]
        for event in snapshot.lifeEvents.values {
            guard event.confirmation == .confirmed, !event.isDismissed, !event.isSensitive,
                  event.explicitness == .explicit, event.signal == .normal, event.category != .interest,
                  event.capturedAt <= context.now, let day = event.eventDay else { continue }
            // Old announcements never become alerts; missing dates never become alerts.
            let delta = today.days(until: day)
            guard delta >= -parameters.lifeUpdateRecencyDays, delta <= parameters.lifeUpdateLeadDays else { continue }
            groups[event.dedupeKey, default: []].append(event)
        }
        var cards: [SuggestionCard] = []
        for (_, events) in groups {
            let sorted = events.sorted { $0.id < $1.id }
            let event = sorted[0]
            guard let person = person(event.personID), let day = event.eventDay else { continue }
            let when = phrasing.relative(from: today, to: day)
            let past = today.days(until: day) < 0
            let title: String
            switch event.category {
            case .newJob: title = past ? "\(person.name) started a new job \(when)" : "\(person.name) starts a new job \(when)"
            case .move: title = past ? "\(person.name) moved \(when)" : "\(person.name) is moving \(when)"
            case .graduation: title = past ? "\(person.name) graduated \(when)" : "\(person.name) graduates \(when)"
            case .performance: title = past ? "\(person.name)'s performance was \(when)" : "\(person.name)'s performance is \(when)"
            case .familyMilestone, .other, .interest: title = "\(person.name): \(event.summary) (\(when))"
            }
            let sourceIDs = Array(Set(sorted.flatMap(\.sourceIDs))).sorted()
            let supporting = snapshot.facts.values
                .filter { $0.personID == person.id && $0.state == .confirmed && !$0.isSensitive && $0.sourceID.map(sourceIDs.contains) == true }
                .sorted { $0.id < $1.id }
                .first
            let detail = supporting.map { "You noted: \($0.value.prefix(1).lowercased() + $0.value.dropFirst())." }
            var items: [ExplanationItem] = []
            for id in sourceIDs { items += sourceItems(id, excerpt: sorted.first(where: { $0.sourceIDs.contains(id) })?.excerpt) }
            if let supporting { items.append(ExplanationItem(label: "Detail", text: supporting.value, date: supporting.updatedAt, evidence: .fact(supporting.id))) }
            cards.append(SuggestionCard(
                occurrenceKey: "\(SuggestionRuleID.lifeUpdate.rawValue)|\(event.dedupeKey.hashValueStable)|\(day.isoString)",
                ruleID: .lifeUpdate,
                personID: person.id,
                tier: .date,
                relevantAt: day.startOfDay(in: context.timeZone),
                title: title,
                detail: detail,
                explanation: CardExplanation(reason: "You confirmed this update; it happens \(when).", items: items),
                evidence: sorted.map { .lifeEvent($0.id) } + sourceIDs.map { .source($0) } + (supporting.map { [.fact($0.id)] } ?? []),
                actions: [.draftMessage, .remindTonight, .dismiss],
                allowsCelebration: event.category != .familyMilestone
            ))
        }
        return cards
    }

    // MARK: Travel (FR15)

    func travelCards() -> [SuggestionCard] {
        var cards: [SuggestionCard] = []
        for trip in snapshot.trips.values where trip.endDay >= today && today.days(until: trip.startDay) <= parameters.travelLeadDays {
            let city = ContactNormalizer.normalizeName(trip.city)
            for person in snapshot.people.values where person.isEligibleForSuggestions {
                guard let personCity = person.city, ContactNormalizer.normalizeName(personCity) == city else { continue }
                let delta = today.days(until: trip.startDay)
                let when: String
                switch delta {
                case ...0: when = "You're in \(trip.city) now"
                case 1: when = "You'll be in \(trip.city) tomorrow"
                case 2...6: when = "You'll be in \(trip.city) in \(delta) days"
                default: when = "You'll be in \(trip.city) next week"
                }
                let lead = trip.isUncertain ? when.replacingOccurrences(of: "You'll be", with: "You might be") + " (plans not confirmed)" : when
                cards.append(SuggestionCard(
                    occurrenceKey: "\(SuggestionRuleID.travelOverlap.rawValue)|\(trip.id)|\(person.id)",
                    ruleID: .travelOverlap,
                    personID: person.id,
                    tier: .context,
                    relevantAt: trip.startDay.startOfDay(in: context.timeZone),
                    title: "\(lead); want to see \(person.name)?",
                    explanation: CardExplanation(reason: "\(person.name)'s city in LittleThings is \(personCity), and you added a trip there.", items: [
                        ExplanationItem(label: "Trip", text: "\(trip.city), \(phrasing.shortMonthDay(trip.startDay))–\(phrasing.shortMonthDay(trip.endDay))", date: trip.createdAt, evidence: .trip(trip.id)),
                    ]),
                    evidence: [.trip(trip.id), .person(person.id)],
                    actions: [.draftMessage, .snooze, .dismiss]
                ))
            }
        }
        return cards
    }

    // MARK: Evidence helpers

    func sourceItems(_ sourceID: SourceID?, excerpt: String?) -> [ExplanationItem] {
        guard let sourceID, let source = snapshot.sources[sourceID] else { return [] }
        let label: String
        switch source.kind {
        case .manualNote: label = "Your note"
        case .shareExtension: label = "Shared to LittleThings"
        case .voiceTranscript: label = "Your voice memo"
        case .ocr: label = "Text from an image"
        case .contactsImport: label = "Contacts"
        case .calendarEvent: label = "Calendar"
        case .fileImport, .providerSync: label = source.title ?? source.provider ?? "Imported"
        }
        let text = excerpt?.nilIfBlank.map { "“\($0)”" } ?? "Source"
        return [ExplanationItem(label: label, text: text, date: source.capturedAt, evidence: .source(sourceID))]
    }
}

extension String {
    /// FNV-1a 64-bit hash, stable across launches (unlike `hashValue`), for opaque keys.
    var hashValueStable: String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }
}
