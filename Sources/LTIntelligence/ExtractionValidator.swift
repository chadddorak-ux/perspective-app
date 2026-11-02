import Foundation
import LTDomain

/// Text normalization used for grounding checks.
public enum Grounding {
    public static func normalize(_ text: String) -> String {
        let replaced = text
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{201C}", with: "\"")
            .replacingOccurrences(of: "\u{201D}", with: "\"")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        return replaced.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    /// The excerpt must appear verbatim (after normalization) in the source.
    public static func excerpt(_ excerpt: String, isIn source: String) -> Bool {
        let e = normalize(excerpt).trimmingCharacters(in: CharacterSet(charactersIn: " .,;:!?\"'"))
        guard e.count >= 3 else { return false }
        return normalize(source).contains(e)
    }

    static let stopwords: Set<String> = ["the", "and", "for", "with", "his", "her", "their", "she", "him", "has", "have", "was", "are", "about", "that", "this", "from", "into", "they", "them", "our", "your", "you"]

    static func contentWords(_ text: String) -> [String] {
        normalize(text).split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count >= 3 && !stopwords.contains($0) }
    }

    /// Most content words of a proposed value must come from its excerpt, so a model cannot
    /// attach an invented value to a real excerpt.
    public static func value(_ value: String, isSupportedBy excerpt: String) -> Bool {
        let words = contentWords(value)
        guard !words.isEmpty else { return false }
        let excerptWords = Set(contentWords(excerpt))
        let supported = words.filter { word in excerptWords.contains { $0 == word || $0.hasPrefix(String(word.prefix(5))) && word.count >= 5 } }
        return Double(supported.count) / Double(words.count) >= 0.6
    }

    static let sensitiveTerms = [
        "diagnos", "cancer", "therapy", "therapist", "depress", "anxiety", "pregnan", "miscarr", "surgery", "chemo",
        "rehab", "sobriety", "divorce", "funeral", "passed away", "died", "illness", "disease", "medication",
        "religion", "religious", "sexual", "gay", "lesbian", "transgender", "immigration status", "arrest",
    ]

    public static func looksSensitive(_ text: String) -> Bool {
        let n = normalize(text)
        return sensitiveTerms.contains { n.contains($0) }
    }
}

/// Resolves a name mentioned in a source to one of the supplied people.
public enum IdentityMatcher {
    public static func resolve(_ name: String?, among people: [PersonHint], linkedPeople: [PersonID]) -> IdentityResolution {
        guard let raw = name?.nilIfBlank else {
            // No name: only safe when the source is linked to exactly one person.
            return linkedPeople.count == 1 ? .resolved(linkedPeople[0]) : .unresolved(nil)
        }
        let target = ContactNormalizer.normalizeName(raw)
        let exact = people.filter { $0.names.contains { ContactNormalizer.normalizeName($0) == target } }
        if exact.count == 1 { return .resolved(exact[0].id) }
        if exact.count > 1 { return .ambiguous(exact.map(\.id).sorted()) }
        let first = target.split(separator: " ").first.map(String.init) ?? target
        let byFirst = people.filter { hint in hint.names.contains { ContactNormalizer.normalizeName($0).split(separator: " ").first.map(String.init) == first } }
        if byFirst.count == 1 { return .resolved(byFirst[0].id) }
        if byFirst.count > 1 { return .ambiguous(byFirst.map(\.id).sorted()) }
        return .unresolved(raw)
    }
}

/// Grounds untrusted extraction output in the source (PRD section 7).
///
/// - Every item needs an excerpt that appears in the source text.
/// - Values must be supported by their excerpt.
/// - Dates are re-derived from the excerpt by `DateTextParser`; model-supplied numbers are
///   never trusted. No date in the text means no date.
/// - Commitments need a commitment cue in the excerpt; a model cannot invent a promise.
/// - Reposts, aspirations, old announcements and third-party mentions are not current events.
/// - Identity must resolve to a supplied person; otherwise the user chooses.
public struct ExtractionValidator: Sendable {
    public var dateParser: DateTextParser

    public init(dateParser: DateTextParser = DateTextParser()) {
        self.dateParser = dateParser
    }

    static let commitmentCues = ["i promised", "promised to", "i'll", "i will", "i'm going to", "im going to", "i am going to", "remind me to", "i need to", "i have to", "i should", "i owe", "said i'd", "said i would", "told him i'd", "told her i'd", "told them i'd", "i offered to"]
    static let theirCommitmentCues = ["he promised", "she promised", "they promised", "he'll", "she'll", "they'll", "he will", "she will", "they will", "offered to"]
    static let followUpCues = ["ask ", "ask how", "check in", "check on", "follow up", "see how", "find out"]
    static let aspirationCues = ["hopes to", "hoping to", "wants to", "would love to", "dreams of", "thinking about", "considering", "might ", "applying", "applied for", "interviewing"]
    static let repostCues = ["reposted", "shared a post", "retweet", "shared an article", "shared someone"]
    static let oldCues = ["years ago", "last year", "back in 19", "back in 20", "a while ago", "long ago"]
    static let lifeCues: [LifeEventCategory: [String]] = [
        .newJob: ["new job", "new role", "started at", "starts at", "joined", "hired", "got the job", "job at", "promoted", "promotion", "team lead", "position at", "starting at"],
        .move: ["moved", "moving", "relocat", "new apartment", "new house"],
        .graduation: ["graduat"],
        .familyMilestone: ["baby", "engaged", "married", "wedding", "newborn", "adopted"],
        .performance: ["recital", "concert", "performance", "show", "play", "game", "race", "marathon", "exhibit"],
        .interest: ["loves", "love ", "into ", "obsessed", "enjoys", "favorite", "favourite", "fan of", "learning"],
        .other: [],
    ]

    public func validate(_ raw: RawExtraction, source: Source, people: [PersonHint], captureDay: CalendarDay) -> ExtractionProposal {
        var proposal = ExtractionProposal()
        let text = source.text

        for fact in raw.facts {
            let name = "fact \(fact.label)"
            guard Grounding.excerpt(fact.excerpt, isIn: text) else { proposal.rejected.append(Rejection(item: name, reason: "Excerpt not found in the note")); continue }
            guard Grounding.value(fact.value, isSupportedBy: fact.excerpt) else { proposal.rejected.append(Rejection(item: name, reason: "Value not supported by the excerpt")); continue }
            let category = FactCategory(rawValue: fact.category) ?? .other
            proposal.facts.append(ProposedFact(
                identity: IdentityMatcher.resolve(fact.personName, among: people, linkedPeople: source.personIDs),
                category: category,
                label: fact.label.trimmed.nilIfBlank ?? category.rawValue.capitalized,
                value: fact.value.trimmed,
                excerpt: fact.excerpt.trimmed,
                isSensitive: category.isSensitiveByDefault || source.sensitivity == .sensitive || Grounding.looksSensitive(fact.excerpt)
            ))
        }

        for date in raw.dates {
            let name = "date \(date.label)"
            guard Grounding.excerpt(date.excerpt, isIn: text) else { proposal.rejected.append(Rejection(item: name, reason: "Excerpt not found in the note")); continue }
            let candidates = dateParser.matches(in: date.excerpt, captureDay: captureDay)
            guard let match = candidates.first(where: { Grounding.normalize($0.text) == Grounding.normalize(date.dateText) }) ?? (candidates.count == 1 ? candidates[0] : nil) else {
                proposal.rejected.append(Rejection(item: name, reason: "No date stated in the excerpt"))
                continue
            }
            let category: DateCategory
            switch date.kind.lowercased() {
            case "birthday": category = .birthday
            case "anniversary": category = .anniversary
            case "custom", "customannual": category = .customAnnual
            default: category = .milestone
            }
            let sensitive = source.sensitivity == .sensitive || Grounding.looksSensitive(date.excerpt)
            proposal.dates.append(ProposedDate(
                identity: IdentityMatcher.resolve(date.personName, among: people, linkedPeople: source.personIDs),
                category: sensitive && category != .birthday ? .careful : category,
                label: date.label.trimmed.nilIfBlank ?? ImportantDate.defaultLabel(for: category),
                match: match,
                excerpt: date.excerpt.trimmed,
                isSensitive: sensitive
            ))
        }

        for promise in raw.promises {
            let name = "promise"
            guard Grounding.excerpt(promise.excerpt, isIn: text) else { proposal.rejected.append(Rejection(item: name, reason: "Excerpt not found in the note")); continue }
            let excerpt = " " + Grounding.normalize(promise.excerpt) + " "
            let isFollowUp = promise.kind == "followUp"
            let mine = ExtractionValidator.commitmentCues.contains { excerpt.contains($0) }
            let theirs = ExtractionValidator.theirCommitmentCues.contains { excerpt.contains($0) }
            let followUp = ExtractionValidator.followUpCues.contains { excerpt.contains($0) }
            guard mine || theirs || (isFollowUp && followUp) else {
                proposal.rejected.append(Rejection(item: name, reason: "The note doesn't state a commitment"))
                continue
            }
            guard Grounding.value(promise.description, isSupportedBy: promise.excerpt) else {
                proposal.rejected.append(Rejection(item: name, reason: "Description not supported by the excerpt"))
                continue
            }
            let due = promise.dueText.flatMap { dueText in
                dateParser.matches(in: promise.excerpt, captureDay: captureDay).first { Grounding.normalize($0.text) == Grounding.normalize(dueText) }
            }
            proposal.promises.append(ProposedPromise(
                identity: IdentityMatcher.resolve(promise.personName, among: people, linkedPeople: source.personIDs),
                kind: isFollowUp && followUp ? .followUp : .commitment,
                ownerIsMe: mine || (isFollowUp && followUp && !theirs),
                description: promise.description.trimmed,
                due: due,
                excerpt: promise.excerpt.trimmed
            ))
        }

        for event in raw.lifeEvents {
            let name = "update \(event.summary)"
            guard Grounding.excerpt(event.excerpt, isIn: text) else { proposal.rejected.append(Rejection(item: name, reason: "Excerpt not found in the note")); continue }
            let category = LifeEventCategory(rawValue: event.category) ?? .other
            let normalized = " " + Grounding.normalize(event.excerpt) + " "
            if ExtractionValidator.repostCues.contains(where: normalized.contains) {
                proposal.rejected.append(Rejection(item: name, reason: "A repost or shared item, not an update about this person"))
                continue
            }
            if ExtractionValidator.oldCues.contains(where: normalized.contains) {
                proposal.rejected.append(Rejection(item: name, reason: "An old announcement, not a current event"))
                continue
            }
            if let cues = ExtractionValidator.lifeCues[category], !cues.isEmpty, !cues.contains(where: normalized.contains) {
                proposal.rejected.append(Rejection(item: name, reason: "The excerpt doesn't describe this kind of update"))
                continue
            }
            let aspiration = ExtractionValidator.aspirationCues.contains(where: normalized.contains)
            let date = event.dateText.flatMap { dateText in
                dateParser.matches(in: event.excerpt, captureDay: captureDay).first { Grounding.normalize($0.text) == Grounding.normalize(dateText) }
            }
            proposal.lifeEvents.append(ProposedLifeEvent(
                identity: IdentityMatcher.resolve(event.personName, among: people, linkedPeople: source.personIDs),
                category: category,
                summary: event.summary.trimmed,
                eventDate: aspiration ? nil : date,
                excerpt: event.excerpt.trimmed,
                explicitness: aspiration ? .inferred : .explicit,
                isSensitive: source.sensitivity == .sensitive || Grounding.looksSensitive(event.excerpt)
            ))
        }
        return proposal
    }
}
