import Foundation
import LTDomain

/// Deterministic, no-AI extraction from common phrasings. Its output is `RawExtraction`
/// and goes through the same `ExtractionValidator` as model output. The UI labels these as
/// "Suggested from your wording", never as AI.
public struct PatternExtractor: Sendable {
    public var dateParser: DateTextParser

    public init(dateParser: DateTextParser = DateTextParser()) {
        self.dateParser = dateParser
    }

    static let relations = "daughter|son|wife|husband|partner|mom|mother|dad|father|sister|brother|kid|child|baby|dog|cat|fiance|fiancee|girlfriend|boyfriend"
    static let eventNouns = "recital|concert|interview|graduation|wedding|game|performance|show|party|race|marathon|exhibit|surgery|appointment|trip|move"

    public func extract(from text: String, people: [PersonHint], captureDay: CalendarDay) -> RawExtraction {
        var raw = RawExtraction()
        let sentences = PatternExtractor.sentences(in: text)
        var lastNamedRelative: String?
        let knownNames = people.flatMap(\.names)

        func mentionedPerson(in sentence: String) -> String? {
            knownNames.first { name in
                let first = name.split(separator: " ").first.map(String.init) ?? name
                return sentence.range(of: #"\b"# + NSRegularExpression.escapedPattern(for: first) + #"\b"#, options: .regularExpression) != nil
            }
        }

        for (index, sentence) in sentences.enumerated() {
            // "Alex's daughter is Maya."
            for m in regexMatches(#"\b([A-Z][a-z]+)'s\s+("# + PatternExtractor.relations + #")\s+is\s+([A-Z][a-z]+)"#, in: sentence) {
                raw.facts.append(RawFact(personName: m[1], category: "family", label: m[2].capitalized, value: m[3], excerpt: sentence))
                lastNamedRelative = m[3]
            }

            // "<Name> loves jazz" / "she's into climbing"
            for m in regexMatches(#"\b([A-Z][a-z]+|[Ss]he|[Hh]e|[Tt]hey)(?:'s| is| are)?\s+(?:loves|love|is into|are into|enjoys|is obsessed with|is a fan of)\s+([^.!?,;]+)"#, in: sentence) {
                let subject = m[1]
                let name = ["she", "he", "they"].contains(subject.lowercased()) ? nil : subject
                raw.facts.append(RawFact(personName: name, category: "interest", label: "Interest", value: m[2].trimmed, excerpt: sentence))
            }

            let dates = dateParser.matches(in: sentence, captureDay: captureDay)
            if let date = dates.first {
                let lower = sentence.lowercased()
                if lower.contains("birthday") {
                    let owner = regexMatches(#"\b([A-Z][a-z]+)'s\s+birthday"#, in: sentence).first?[1]
                    raw.dates.append(RawDate(personName: owner, label: "Birthday", kind: "birthday", dateText: date.text, excerpt: sentence))
                } else if lower.contains("anniversary") {
                    raw.dates.append(RawDate(personName: nil, label: "Anniversary", kind: "anniversary", dateText: date.text, excerpt: sentence))
                } else if let m = regexMatches(#"\b(?:(her|his|their|[A-Z][a-z]+'s)\s+)?("# + PatternExtractor.eventNouns + #")\b"#, in: sentence).first {
                    let possessor = m[1]
                    var label = m[2].capitalized
                    if possessor.hasSuffix("'s") {
                        label = "\(possessor) \(m[2])"
                    } else if ["her", "his", "their"].contains(possessor.lowercased()), let relative = lastNamedRelative {
                        label = "\(relative)'s \(m[2])"
                    }
                    raw.dates.append(RawDate(personName: nil, label: label, kind: "milestone", dateText: date.text, excerpt: sentence))
                }
            }

            // Commitments: "I promised to send him the photographer's number."
            for m in regexMatches(#"(?i)\b(?:I promised to|I'll|I will|I need to|remind me to|I have to|I said I'd|I told (?:him|her|them) I'd|I offered to)\s+([^.!?]+)"#, in: sentence) {
                let description = PatternExtractor.capitalizeFirst(m[1].trimmed)
                let due = dateParser.matches(in: sentence, captureDay: captureDay).first?.text
                raw.promises.append(RawPromise(personName: mentionedPerson(in: sentence), description: description, owner: "me", kind: "commitment", dueText: due, excerpt: sentence))
            }
            // Follow-ups: "Ask Sam how the interview went."
            for m in regexMatches(#"\b[Aa]sk\s+(?:him|her|them|[A-Z][a-z]+)\s+((?:how|about|if|whether)\s+[^.!?]+)"#, in: sentence) {
                let due = dateParser.matches(in: sentence, captureDay: captureDay).first?.text
                raw.promises.append(RawPromise(personName: mentionedPerson(in: sentence), description: PatternExtractor.capitalizeFirst("ask " + m[1].trimmed), owner: "me", kind: "followUp", dueText: due, excerpt: sentence))
            }

            // New job, possibly with the start date in the next sentence.
            let lower = sentence.lowercased()
            if lower.range(of: #"\b(new job|new role|got the (?:[a-z ]+ )?job|job at|started at|starts at|joined|promoted)\b"#, options: .regularExpression) != nil {
                var excerpt = sentence
                var dateText = dates.first?.text
                if dateText == nil, index + 1 < sentences.count {
                    let next = sentences[index + 1]
                    if next.lowercased().range(of: #"\b(starts|starting|begins|first day)\b"#, options: .regularExpression) != nil,
                       let nextDate = dateParser.matches(in: next, captureDay: captureDay).first {
                        excerpt = sentence + " " + next
                        dateText = nextDate.text
                    }
                }
                raw.lifeEvents.append(RawLifeEvent(personName: mentionedPerson(in: sentence), category: "newJob", summary: PatternExtractor.summary(sentence), dateText: dateText, excerpt: excerpt))
            }
            if let m = regexMatches(#"\b(?:moving|moved|relocating|relocated)\s+to\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)"#, in: sentence).first {
                raw.lifeEvents.append(RawLifeEvent(personName: mentionedPerson(in: sentence), category: "move", summary: "Moving to \(m[1])", dateText: dates.first?.text, excerpt: sentence))
            }
            if lower.contains("graduat") {
                raw.lifeEvents.append(RawLifeEvent(personName: mentionedPerson(in: sentence), category: "graduation", summary: PatternExtractor.summary(sentence), dateText: dates.first?.text, excerpt: sentence))
            }
        }
        return raw
    }

    /// Splits into sentences, keeping terminal punctuation. Contiguous in the source.
    public static func sentences(in text: String) -> [String] {
        var result: [String] = []
        var current = ""
        let chars = Array(text)
        for (i, c) in chars.enumerated() {
            current.append(c)
            let atEnd = i + 1 == chars.count
            if c == "\n" || ((c == "." || c == "!" || c == "?") && (atEnd || chars[i + 1].isWhitespace)) {
                let trimmed = current.trimmed
                if !trimmed.isEmpty { result.append(trimmed) }
                current = ""
            }
        }
        let trimmed = current.trimmed
        if !trimmed.isEmpty { result.append(trimmed) }
        return result
    }

    static func capitalizeFirst(_ s: String) -> String {
        guard let first = s.first else { return s }
        return first.uppercased() + s.dropFirst()
    }

    static func summary(_ sentence: String) -> String {
        let trimmed = sentence.trimmingCharacters(in: CharacterSet(charactersIn: " .!?"))
        return trimmed.count > 90 ? String(trimmed.prefix(87)) + "..." : trimmed
    }
}

/// Which validated items may be saved without review under a source's auto-save setting.
/// Only explicit, non-sensitive, identity-resolved facts and fully explicit dates qualify;
/// they are saved as `.unconfirmed` / `.autoSaved` and never trigger reminders until the user
/// confirms them. Promises and life updates always require review.
public enum AutoSavePolicy {
    public static func canAutoSave(_ fact: ProposedFact) -> Bool {
        fact.identity.personID != nil && !fact.isSensitive && !fact.category.isSensitiveByDefault
    }

    public static func canAutoSave(_ date: ProposedDate) -> Bool {
        date.identity.personID != nil && !date.isSensitive && date.match.interpretation == .explicit
    }
}

/// Turns reviewed proposals into records with provenance.
public enum ProposalMaterializer {
    public static func fact(_ proposal: ProposedFact, personID: PersonID, source: Source, confirmed: Bool, autoSaved: Bool = false, now: Date) -> Fact {
        Fact(
            personID: personID,
            category: proposal.category,
            label: proposal.label,
            value: proposal.value,
            sourceID: source.id,
            excerpt: proposal.excerpt,
            state: confirmed ? .confirmed : .unconfirmed,
            origin: autoSaved ? .autoSaved : (source.kind == .fileImport || source.kind == .providerSync ? .imported : .extracted),
            isSensitive: proposal.isSensitive,
            createdAt: now
        )
    }

    public static func date(_ proposal: ProposedDate, personID: PersonID, source: Source, confirmed: Bool, leapDayPolicy: LeapDayPolicy? = nil, now: Date) -> ImportantDate {
        ImportantDate(
            personID: personID,
            category: proposal.category,
            label: proposal.label,
            schedule: proposal.schedule,
            leapDayPolicy: leapDayPolicy,
            remindersEnabled: proposal.category == .careful ? false : nil,
            isSensitive: proposal.isSensitive,
            confirmation: confirmed ? .confirmed : .unconfirmed,
            sourceID: source.id,
            excerpt: proposal.excerpt,
            createdAt: now
        )
    }

    public static func promise(_ proposal: ProposedPromise, personIDs: [PersonID], source: Source, confirmed: Bool, now: Date) -> Promise {
        Promise(
            personIDs: personIDs,
            kind: proposal.kind,
            owner: proposal.ownerIsMe ? .me : (personIDs.first.map(PromiseOwner.person) ?? .me),
            description: proposal.description,
            due: proposal.due.map { .day($0.resolvedDay) },
            confirmation: confirmed ? .confirmed : .unconfirmed,
            sourceID: source.id,
            excerpt: proposal.excerpt,
            createdAt: now
        )
    }

    public static func lifeEvent(_ proposal: ProposedLifeEvent, personID: PersonID, source: Source, confirmed: Bool, now: Date) -> LifeEvent {
        LifeEvent(
            personID: personID,
            category: proposal.category,
            summary: proposal.summary,
            sourceIDs: [source.id],
            excerpt: proposal.excerpt,
            eventDay: proposal.eventDate?.resolvedDay,
            capturedAt: source.capturedAt,
            explicitness: proposal.explicitness,
            signal: .normal,
            confirmation: confirmed ? .confirmed : .unconfirmed,
            isSensitive: proposal.isSensitive,
            createdAt: now
        )
    }
}
