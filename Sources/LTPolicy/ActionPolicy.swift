import Foundation
import LTCryptoSupport
import LTDomain

/// Where a proposed action came from. Origin never grants authority by itself.
public enum ProposalOrigin: Hashable, Sendable {
    /// The user tapped a control for this exact action.
    case user
    /// An active automation rule fired for a trigger occurrence.
    case rule(AutomationRuleID, occurrence: String)
    /// A local model or imported content suggested it. Can never authorize anything.
    case model
}

public struct PurchaseDetails: Hashable, Sendable {
    public var item: String
    public var merchant: String
    public var recipientPersonID: PersonID
    public var shippingAddress: String
    public var requestedDelivery: CalendarDay?
    public var itemPrice: Money
    public var tax: Money
    public var shipping: Money

    public init(item: String, merchant: String, recipientPersonID: PersonID, shippingAddress: String, requestedDelivery: CalendarDay?, itemPrice: Money, tax: Money, shipping: Money) {
        self.item = item
        self.merchant = merchant
        self.recipientPersonID = recipientPersonID
        self.shippingAddress = shippingAddress
        self.requestedDelivery = requestedDelivery
        self.itemPrice = itemPrice
        self.tax = tax
        self.shipping = shipping
    }

    /// Full total; nil if currencies differ (never silently converted).
    public var total: Money? {
        guard itemPrice.currencyCode == tax.currencyCode, tax.currencyCode == shipping.currencyCode else { return nil }
        return Money(minorUnits: itemPrice.minorUnits + tax.minorUnits + shipping.minorUnits, currencyCode: itemPrice.currencyCode)
    }
}

public struct ActionProposal: Hashable, Sendable {
    public var kind: ActionKind
    public var recipientPersonID: PersonID?
    public var recipientAddress: String?
    public var channel: MessageChannel?
    public var payload: String
    public var evidence: [EvidenceRef]
    public var origin: ProposalOrigin
    public var purchase: PurchaseDetails?

    public init(kind: ActionKind, recipientPersonID: PersonID?, recipientAddress: String?, channel: MessageChannel?, payload: String, evidence: [EvidenceRef], origin: ProposalOrigin, purchase: PurchaseDetails? = nil) {
        self.kind = kind
        self.recipientPersonID = recipientPersonID
        self.recipientAddress = recipientAddress
        self.channel = channel
        self.payload = payload
        self.evidence = evidence
        self.origin = origin
        self.purchase = purchase
    }

    /// Binds an approval to the exact recipient, channel, payload and purchase terms.
    public var digest: String {
        var parts = [kind.rawValue, recipientPersonID?.uuidString ?? "-", recipientAddress ?? "-", channel?.rawValue ?? "-", payload]
        if let p = purchase {
            parts += [p.item, p.merchant, p.recipientPersonID.uuidString, p.shippingAddress, p.requestedDelivery?.isoString ?? "-",
                      "\(p.itemPrice.minorUnits)\(p.itemPrice.currencyCode)", "\(p.tax.minorUnits)\(p.tax.currencyCode)", "\(p.shipping.minorUnits)\(p.shipping.currencyCode)"]
        }
        return PolicyDigest.hex(parts.joined(separator: "\u{1F}"))
    }
}

/// A transaction-specific approval captured from the user (for example a confirm tap on a
/// screen showing the exact recipient and text, or an Apple Pay sheet authorization).
public struct UserApproval: Hashable, Sendable {
    public var proposalDigest: String
    public var approvedAt: Date
    public var expiresAt: Date

    public init(proposalDigest: String, approvedAt: Date, validFor seconds: TimeInterval = 300) {
        self.proposalDigest = proposalDigest
        self.approvedAt = approvedAt
        self.expiresAt = approvedAt.addingTimeInterval(seconds)
    }
}

/// What a channel can verifiably do on this device. Empty by default: no channel has proven
/// unattended send semantics in this build (see capability matrix), so rules fall back to review.
public struct ChannelCapabilities: Hashable, Sendable {
    public var unattendedSend: Set<MessageChannel>
    public var reportsDelivery: Set<MessageChannel>
    public var supportsIdempotency: Set<MessageChannel>

    public init(unattendedSend: Set<MessageChannel> = [], reportsDelivery: Set<MessageChannel> = [], supportsIdempotency: Set<MessageChannel> = []) {
        self.unattendedSend = unattendedSend
        self.reportsDelivery = reportsDelivery
        self.supportsIdempotency = supportsIdempotency
    }

    public static let none = ChannelCapabilities()
}

public struct PolicyContext: Sendable {
    public var snapshot: VaultSnapshot
    public var evaluation: EvaluationContext
    public var channels: ChannelCapabilities
    /// Global automation pause from Settings.
    public var automationPaused: Bool

    public init(snapshot: VaultSnapshot, evaluation: EvaluationContext, channels: ChannelCapabilities = .none, automationPaused: Bool = false) {
        self.snapshot = snapshot
        self.evaluation = evaluation
        self.channels = channels
        self.automationPaused = automationPaused
    }
}

public enum PolicyDecision: Hashable, Sendable {
    /// Hand the action to the user's chosen service now. The attempt must be persisted
    /// (idempotency key is unique in the vault) before the handoff.
    case execute(ActionAttempt)
    /// Show the action for the user to review and confirm. Never sent automatically.
    case requireReview([String])
    /// Not allowed at all.
    case deny([String])
    /// A rule's window passed (e.g. long offline period): record it as expired and ask.
    case expired(ActionAttempt)
}

/// Deterministic outbound-action policy. A model cannot grant itself authority: authority
/// comes only from a `UserApproval` bound to the exact proposal or from an approved, active,
/// in-scope automation rule on a channel with verified unattended-send support.
public struct ActionPolicy: Sendable {
    public init() {}

    public func evaluate(_ proposal: ActionProposal, approval: UserApproval?, context: PolicyContext) -> PolicyDecision {
        let now = context.evaluation.now
        var problems: [String] = []

        // Recipient must be a real, current person whose address matches what is shown.
        if let personID = proposal.recipientPersonID {
            guard let person = context.snapshot.people[personID] else { return .deny(["Recipient no longer exists"]) }
            if person.isArchived { problems.append("Recipient is archived") }
            if let address = proposal.recipientAddress, proposal.kind == .sendMessage, !addressBelongs(address, to: person) {
                problems.append("Recipient address doesn't match \(person.name)'s saved details")
            }
        } else if proposal.kind == .sendMessage {
            problems.append("No recipient selected")
        }
        // Evidence must still exist (deleted sources invalidate pending actions).
        if !evidenceExists(proposal.evidence, in: context.snapshot) {
            return .deny(["Supporting information was deleted"])
        }

        if let approval {
            guard approval.proposalDigest == proposal.digest else {
                return .requireReview(problems + ["The recipient or content changed after approval"])
            }
            guard now <= approval.expiresAt else {
                return .requireReview(problems + ["The approval expired"])
            }
            if proposal.kind == .purchase {
                guard let purchase = proposal.purchase, purchase.total != nil else {
                    return .deny(["Purchase total is missing or mixes currencies"])
                }
            }
            guard problems.isEmpty else { return .requireReview(problems) }
            return .execute(attempt(for: proposal, key: "approval|\(approval.proposalDigest)", ruleID: nil, approvalDigest: approval.proposalDigest, now: now))
        }

        switch proposal.origin {
        case .model:
            return .requireReview(problems + ["Suggestions can't send, buy or share anything without your approval"])
        case .user:
            return .requireReview(problems + ["Confirm to continue"])
        case .rule(let ruleID, let occurrence):
            if proposal.kind == .purchase {
                return .deny(["Automation rules can never make purchases"])
            }
            guard proposal.kind == .sendMessage else {
                return .requireReview(problems + ["Only messages can be automated"])
            }
            return evaluateRule(ruleID: ruleID, occurrence: occurrence, proposal: proposal, problems: problems, context: context)
        }
    }

    func evaluateRule(ruleID: AutomationRuleID, occurrence: String, proposal: ActionProposal, problems initial: [String], context: PolicyContext) -> PolicyDecision {
        let now = context.evaluation.now
        var problems = initial
        guard let rule = context.snapshot.automationRules[ruleID] else { return .deny(["The rule no longer exists"]) }
        let key = "rule|\(rule.id)|\(proposal.recipientPersonID?.uuidString ?? "-")|\(occurrence)"

        // Deduplication: one submission per rule, recipient and trigger occurrence.
        if let previous = context.snapshot.actionAttempts.values.first(where: { $0.idempotencyKey == key }) {
            if previous.status == .unknown {
                return .deny(["A previous attempt has an unknown outcome; not retrying to avoid a duplicate"])
            }
            return .deny(["Already handled for this occasion"])
        }
        if context.automationPaused { return .requireReview(problems + ["Automation is paused"]) }
        if rule.isPaused { return .requireReview(problems + ["This rule is paused"]) }
        guard let approval = rule.approval, approval.scopeDigest == AutomationScope.digest(rule) else {
            return .requireReview(problems + ["This rule changed and needs your approval again"])
        }
        if now >= rule.expiresAt { return .requireReview(problems + ["This rule has expired"]) }
        guard let recipient = rule.recipients.first(where: { $0.personID == proposal.recipientPersonID }),
              recipient.address == proposal.recipientAddress else {
            return .requireReview(problems + ["This recipient isn't in the rule's approved list"])
        }
        if proposal.channel != rule.channel { problems.append("Different channel than the rule allows") }
        if let person = context.snapshot.people[recipient.personID], person.reminderPreferences.isPaused {
            problems.append("Reminders for this person are paused")
        }

        // Trigger validity, freshness and sensitivity.
        switch rule.trigger {
        case .annualDate(let category):
            guard category != .careful else { return .deny(["Careful dates are never automated"]) }
            guard let date = context.snapshot.importantDates.values.first(where: {
                $0.personID == recipient.personID && $0.category == category && occurrence.hasPrefix($0.id.uuidString)
            }) else { return .deny(["The date for this rule no longer exists"]) }
            if date.isSensitive || date.confirmation != .confirmed { problems.append("This date needs review") }
            let day = CalendarDay(isoString: String(occurrence.split(separator: "|").last ?? "")) ?? context.evaluation.today
            if day < context.evaluation.today {
                return .expired(attempt(for: proposal, key: key, ruleID: rule.id, approvalDigest: approval.scopeDigest, now: now, status: .expired))
            }
            if day > context.evaluation.today { return .requireReview(problems + ["Not due yet"]) }
        case .meetingMarkedAttended:
            guard let link = context.snapshot.calendarLinks.values.first(where: { occurrence.hasPrefix($0.id.uuidString) }),
                  link.attendance == .attended, link.personIDs.contains(recipient.personID) else {
                return .deny(["The meeting wasn't confirmed as attended"])
            }
            if now.timeIntervalSince(link.endsAt) > 2 * 86_400 {
                return .expired(attempt(for: proposal, key: key, ruleID: rule.id, approvalDigest: approval.scopeDigest, now: now, status: .expired))
            }
        }

        // Time window (local) — outside it, wait or ask; never send at a surprising time.
        let time = context.evaluation.timeOfDay
        if time < rule.windowStart || time >= rule.windowEnd { return .requireReview(problems + ["Outside the rule's time window"]) }

        // Frequency limit.
        let windowStart = now.addingTimeInterval(-Double(rule.frequencyLimit.perDays) * 86_400)
        let recent = context.snapshot.actionAttempts.values.filter {
            $0.ruleID == rule.id && $0.recipientPersonID == recipient.personID && $0.createdAt >= windowStart &&
                [.submitted, .sent, .delivered, .unknown].contains($0.status)
        }
        if recent.count >= rule.frequencyLimit.maxSends { return .deny(["Frequency limit reached"]) }

        // Content must be the approved template (bounded personalization is validated upstream
        // and still has to start from the template).
        let rendered = AutomationScope.render(rule.template, name: context.snapshot.people[recipient.personID]?.name ?? "")
        if !(proposal.payload == rendered || (rule.allowsBoundedPersonalization && proposal.payload.hasPrefix(rendered))) {
            problems.append("Message differs from the approved template")
        }

        // Channel must have verified unattended-send support; otherwise review.
        if let channel = proposal.channel, !context.channels.unattendedSend.contains(channel) {
            problems.append("This channel can't send without you on this device")
        }
        guard problems.isEmpty else { return .requireReview(problems) }
        return .execute(attempt(for: proposal, key: key, ruleID: rule.id, approvalDigest: approval.scopeDigest, now: now))
    }

    func attempt(for proposal: ActionProposal, key: String, ruleID: AutomationRuleID?, approvalDigest: String?, now: Date, status: ActionAttemptStatus = .submitted) -> ActionAttempt {
        ActionAttempt(
            kind: proposal.kind,
            ruleID: ruleID,
            approvalDigest: approvalDigest,
            idempotencyKey: key,
            recipientPersonID: proposal.recipientPersonID,
            recipientAddress: proposal.recipientAddress,
            channel: proposal.channel,
            payloadDigest: PolicyDigest.hex(proposal.payload),
            status: status,
            createdAt: now
        )
    }

    func addressBelongs(_ address: String, to person: Person) -> Bool {
        if address.contains("@") {
            return person.emailAddresses.contains { ContactNormalizer.normalizeEmail($0.value) == ContactNormalizer.normalizeEmail(address) }
        }
        return person.phoneNumbers.contains { ContactNormalizer.phonesMatch($0.value, address) }
    }

    func evidenceExists(_ evidence: [EvidenceRef], in snapshot: VaultSnapshot) -> Bool {
        evidence.allSatisfy { ref in
            switch ref {
            case .source(let id): return snapshot.sources[id] != nil
            case .fact(let id): return snapshot.facts[id] != nil
            case .importantDate(let id): return snapshot.importantDates[id] != nil
            case .promise(let id): return snapshot.promises[id] != nil
            case .interaction(let id): return snapshot.interactions[id] != nil
            case .calendarLink(let id): return snapshot.calendarLinks[id] != nil
            case .lifeEvent(let id): return snapshot.lifeEvents[id] != nil
            case .trip(let id): return snapshot.trips[id] != nil
            case .gift(let id): return snapshot.gifts[id] != nil
            case .person(let id): return snapshot.people[id] != nil
            }
        }
    }
}

/// Canonical scope of a rule. Any change to recipients, channel, trigger, template,
/// personalization, permitted context, window, expiry or frequency changes the digest and
/// voids the previous approval.
public enum AutomationScope {
    public static func digest(_ rule: AutomationRule) -> String {
        let recipients = rule.recipients.map { "\($0.personID.uuidString)=\($0.address)" }.sorted().joined(separator: ",")
        let trigger: String
        switch rule.trigger {
        case .annualDate(let category): trigger = "annual:\(category.rawValue)"
        case .meetingMarkedAttended: trigger = "meetingAttended"
        }
        let parts = [
            recipients, rule.channel.rawValue, trigger, rule.template, String(rule.allowsBoundedPersonalization),
            rule.permittedContext.map(\.rawValue).sorted().joined(separator: ","),
            "\(rule.windowStart)-\(rule.windowEnd)", String(Int(rule.expiresAt.timeIntervalSince1970)),
            "\(rule.frequencyLimit.maxSends)/\(rule.frequencyLimit.perDays)",
        ]
        return PolicyDigest.hex(parts.joined(separator: "\u{1F}"))
    }

    public static func render(_ template: String, name: String) -> String {
        template.replacingOccurrences(of: "{name}", with: name)
    }

    /// The only way to approve a rule: called from the review screen after the user saw the
    /// example output. Imported text and model output have no path to this function.
    public static func approve(_ rule: AutomationRule, previewedExample: String, now: Date) -> AutomationRule {
        var approved = rule
        approved.approval = RuleApproval(approvedAt: now, scopeDigest: digest(rule), previewedExample: previewedExample)
        approved.isPaused = false
        approved.updatedAt = now
        return approved
    }
}

/// Records provider outcomes without ever upgrading uncertainty into success.
public enum ActionOutcomeRecorder {
    public enum ProviderReport: Hashable, Sendable {
        case accepted
        case sent
        case delivered
        case failed(String)
        case cancelled
        /// Timeout, crash or no callback: outcome cannot be determined.
        case noResponse
    }

    public static func record(_ report: ProviderReport, on attempt: ActionAttempt, channel: ChannelCapabilities, now: Date) -> ActionAttempt {
        var updated = attempt
        switch report {
        case .accepted: updated.status = .submitted
        case .sent: updated.status = .sent
        case .delivered:
            // Only channels that actually report delivery may claim it.
            updated.status = attempt.channel.map(channel.reportsDelivery.contains) == true ? .delivered : .sent
        case .failed(let reason):
            updated.status = .failed
            updated.providerStatus = reason
        case .cancelled: updated.status = .cancelled
        case .noResponse: updated.status = .unknown
        }
        updated.updatedAt = now
        return updated
    }
}

/// Gift links and searches (FR9, FR15).
public enum GiftActions {
    /// The URL exactly as the user saved it, only for http(s). No notes or identifiers are
    /// appended, and opening it never marks anything purchased.
    public static func urlToOpen(_ gift: GiftIdea) -> URL? {
        guard let url = gift.url, let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http" else { return nil }
        return url
    }

    /// A short, non-identifying search query derived locally from confirmed interests.
    /// Never includes names, addresses, notes or conversation text.
    public static func searchQuery(interests: [Fact], budget: Money?, person: Person) -> String? {
        let personWords = Set(ContactNormalizer.normalizeName(person.displayName + " " + (person.preferredName ?? "")).split(separator: " ").map(String.init))
        let words = interests
            .filter { $0.state == .confirmed && !$0.isSensitive && ($0.category == .interest || $0.category == .giftPreference) }
            .sorted { $0.id < $1.id }
            .prefix(2)
            .flatMap { ContactNormalizer.normalizeName($0.value).split(separator: " ").map(String.init) }
            .filter { !personWords.contains($0) && $0.count > 2 }
        guard !words.isEmpty else { return nil }
        var seen = Set<String>()
        var query = words.filter { seen.insert($0).inserted }.prefix(4).joined(separator: " ") + " gift"
        if let budget, budget.minorUnits > 0 {
            query += " under \(budget.minorUnits / 100) \(budget.currencyCode)"
        }
        return query
    }
}

enum PolicyDigest {
    static func hex(_ string: String) -> String {
        SHA256.hash(data: Data(string.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
