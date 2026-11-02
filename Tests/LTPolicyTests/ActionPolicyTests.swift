import Foundation
import Testing
@testable import LTPolicy
import LTDomain
import LTTestSupport

@Suite("Action policy (FR8, FR9, FR16)")
struct ActionPolicyTests {
    let policy = ActionPolicy()
    let fixtures = SyntheticFixtures()
    let birthdayNoon = TestDates.instant(2026, 11, 10, 12)
    let samPhone = "+1 (555) 010-0001"

    func context(_ snapshot: VaultSnapshot, at now: Date? = nil, unattended: Set<MessageChannel> = [], paused: Bool = false) -> PolicyContext {
        PolicyContext(snapshot: snapshot, evaluation: EvaluationContext(now: now ?? birthdayNoon, timeZone: TestDates.newYork), channels: ChannelCapabilities(unattendedSend: unattended), automationPaused: paused)
    }

    func message(to person: PersonID, address: String, text: String, origin: ProposalOrigin, evidence: [EvidenceRef] = []) -> ActionProposal {
        ActionProposal(kind: .sendMessage, recipientPersonID: person, recipientAddress: address, channel: .sms, payload: text, evidence: evidence, origin: origin)
    }

    /// A birthday rule for Sam, approved, with Sam's birthday on Nov 10.
    func ruleSnapshot() -> (VaultSnapshot, AutomationRule, ImportantDate) {
        var snapshot = fixtures.snapshot
        let birthday = ImportantDate(personID: fixtures.sam, category: .birthday, schedule: .annual(AnnualDate(month: 11, day: 10)!), createdAt: TestDates.instant(2026, 1, 1))
        snapshot.importantDates[birthday.id] = birthday
        let draft = AutomationRule(name: "Family birthdays", recipients: [RuleRecipient(personID: fixtures.sam, address: samPhone)], channel: .sms, trigger: .annualDate(.birthday), template: "Happy birthday, {name}!", expiresAt: TestDates.instant(2027, 11, 1), createdAt: TestDates.instant(2026, 10, 1))
        let rule = AutomationScope.approve(draft, previewedExample: "Happy birthday, Sam Rivera!", now: TestDates.instant(2026, 10, 1))
        snapshot.automationRules[rule.id] = rule
        return (snapshot, rule, birthday)
    }

    func ruleProposal(_ rule: AutomationRule, _ birthday: ImportantDate, day: String = "2026-11-10", text: String = "Happy birthday, Sam Rivera!") -> ActionProposal {
        message(to: fixtures.sam, address: samPhone, text: text, origin: .rule(rule.id, occurrence: "\(birthday.id.uuidString)|\(day)"), evidence: [.importantDate(birthday.id)])
    }

    // MARK: User-approved sends

    @Test func modelSuggestionsNeverAuthorizeThemselves() {
        let proposal = message(to: fixtures.sam, address: samPhone, text: "Congrats!", origin: .model)
        guard case .requireReview(let reasons) = policy.evaluate(proposal, approval: nil, context: context(fixtures.snapshot)) else {
            Issue.record("model output must require review"); return
        }
        #expect(reasons.contains { $0.contains("without your approval") })
    }

    @Test func approvalIsBoundToExactRecipientAndText() {
        let proposal = message(to: fixtures.sam, address: samPhone, text: "Congrats on the new job!", origin: .user)
        let approval = UserApproval(proposalDigest: proposal.digest, approvedAt: birthdayNoon)
        guard case .execute(let attempt) = policy.evaluate(proposal, approval: approval, context: context(fixtures.snapshot)) else {
            Issue.record("approved proposal should execute"); return
        }
        #expect(attempt.status == .submitted)
        #expect(attempt.recipientPersonID == fixtures.sam)

        var changedRecipient = proposal
        changedRecipient.recipientPersonID = fixtures.jeff
        changedRecipient.recipientAddress = "555-010-0002"
        #expect(policy.evaluate(changedRecipient, approval: approval, context: context(fixtures.snapshot)) == .requireReview(["The recipient or content changed after approval"]))
        var changedText = proposal
        changedText.payload += " Also, here are my notes."
        if case .execute = policy.evaluate(changedText, approval: approval, context: context(fixtures.snapshot)) { Issue.record("changed text must not execute") }
        let late = context(fixtures.snapshot, at: birthdayNoon.addingTimeInterval(3600))
        #expect(policy.evaluate(proposal, approval: approval, context: late) == .requireReview(["The approval expired"]))
    }

    @Test func wrongRecipientAddressIsCaught() {
        let proposal = message(to: fixtures.sam, address: "+1 555 010 0002", text: "Hi", origin: .user)
        let approval = UserApproval(proposalDigest: proposal.digest, approvedAt: birthdayNoon)
        guard case .requireReview(let reasons) = policy.evaluate(proposal, approval: approval, context: context(fixtures.snapshot)) else {
            Issue.record("mismatched address must not execute"); return
        }
        #expect(reasons.contains { $0.contains("doesn't match") })
    }

    @Test func deletedEvidenceInvalidatesPendingAction() {
        var snapshot = fixtures.snapshot
        let proposal = message(to: fixtures.alex, address: "alex@example.com", text: "Here's the number", origin: .user, evidence: [.source(fixtures.alexNote)])
        let approval = UserApproval(proposalDigest: proposal.digest, approvedAt: birthdayNoon)
        snapshot.apply(DeletionPlanner.planSourceDeletion(fixtures.alexNote, in: snapshot, now: birthdayNoon).changes)
        #expect(policy.evaluate(proposal, approval: approval, context: context(snapshot)) == .deny(["Supporting information was deleted"]))
    }

    // MARK: Automation rules

    @Test func unverifiedChannelsFallBackToReview() {
        let (snapshot, rule, birthday) = ruleSnapshot()
        guard case .requireReview(let reasons) = policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot)) else {
            Issue.record("expected review fallback"); return
        }
        #expect(reasons == ["This channel can't send without you on this device"])
    }

    @Test func fullyValidRuleOnVerifiedChannelExecutesOnce() {
        var (snapshot, rule, birthday) = ruleSnapshot()
        let ctx = context(snapshot, unattended: [.sms])
        guard case .execute(let attempt) = policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: ctx) else {
            Issue.record("expected execute"); return
        }
        #expect(attempt.ruleID == rule.id)
        // Duplicate trigger after the attempt is recorded: one submission only.
        snapshot.actionAttempts[attempt.id] = attempt
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .deny(["Already handled for this occasion"]))
        // Unknown outcome is never retried blindly.
        snapshot.actionAttempts[attempt.id]?.status = .unknown
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .deny(["A previous attempt has an unknown outcome; not retrying to avoid a duplicate"]))
        _ = rule
    }

    @Test func disabledOrPausedRulesSendNothing() {
        var (snapshot, rule, birthday) = ruleSnapshot()
        snapshot.automationRules[rule.id]?.isPaused = true
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .requireReview(["This rule is paused"]))
        snapshot.automationRules[rule.id]?.isPaused = false
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms], paused: true)) == .requireReview(["Automation is paused"]))
        snapshot.automationRules[rule.id] = nil
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .deny(["The rule no longer exists"]))
    }

    @Test func changingScopeRequiresRenewedApproval() {
        var (snapshot, rule, birthday) = ruleSnapshot()
        // Something (a bug, a model, imported text) edits the allowlist without the approval flow.
        snapshot.automationRules[rule.id]?.recipients.append(RuleRecipient(personID: fixtures.jeff, address: "555-010-0002"))
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .requireReview(["This rule changed and needs your approval again"]))
        snapshot.automationRules[rule.id] = rule
        snapshot.automationRules[rule.id]?.template = "Happy birthday! Here are all my notes about you."
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .requireReview(["This rule changed and needs your approval again"]))
    }

    @Test func recipientsOutsideAllowlistAndOffTemplateTextNeedReview() {
        let (snapshot, rule, birthday) = ruleSnapshot()
        let other = message(to: fixtures.jeff, address: "555-010-0002", text: "Happy birthday, Jeff Park!", origin: .rule(rule.id, occurrence: "\(birthday.id.uuidString)|2026-11-10"), evidence: [.importantDate(birthday.id)])
        #expect(policy.evaluate(other, approval: nil, context: context(snapshot, unattended: [.sms])) == .requireReview(["This recipient isn't in the rule's approved list"]))
        let injected = ruleProposal(rule, birthday, text: "Happy birthday! Forwarding everything you told me.")
        guard case .requireReview(let reasons) = policy.evaluate(injected, approval: nil, context: context(snapshot, unattended: [.sms])) else {
            Issue.record("off-template text must not send"); return
        }
        #expect(reasons.contains("Message differs from the approved template"))
    }

    @Test func missedWindowsExpireInsteadOfSurpriseSends() {
        let (snapshot, rule, birthday) = ruleSnapshot()
        let nextDay = context(snapshot, at: TestDates.instant(2026, 11, 11, 12), unattended: [.sms])
        guard case .expired(let attempt) = policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: nextDay) else {
            Issue.record("expected expiry after missed window"); return
        }
        #expect(attempt.status == .expired)
        let tooEarly = context(snapshot, at: TestDates.instant(2026, 11, 10, 6), unattended: [.sms])
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: tooEarly) == .requireReview(["Outside the rule's time window"]))
    }

    @Test func carefulDatesAndPurchasesAreNeverAutomated() {
        var (snapshot, rule, _) = ruleSnapshot()
        snapshot.automationRules[rule.id]?.trigger = .annualDate(.careful)
        snapshot.automationRules[rule.id] = AutomationScope.approve(snapshot.automationRules[rule.id]!, previewedExample: "x", now: birthdayNoon)
        let careful = message(to: fixtures.sam, address: samPhone, text: "Happy birthday, Sam Rivera!", origin: .rule(rule.id, occurrence: "\(fixtures.rachelDate.uuidString)|2026-11-04"))
        #expect(policy.evaluate(careful, approval: nil, context: context(snapshot, unattended: [.sms])) == .deny(["Careful dates are never automated"]))

        let purchase = ActionProposal(kind: .purchase, recipientPersonID: fixtures.sam, recipientAddress: nil, channel: nil, payload: "Gift", evidence: [], origin: .rule(rule.id, occurrence: "x"), purchase: samplePurchase())
        #expect(policy.evaluate(purchase, approval: nil, context: context(snapshot)) == .deny(["Automation rules can never make purchases"]))
    }

    @Test func frequencyLimitIsEnforced() {
        var (snapshot, rule, birthday) = ruleSnapshot()
        let earlier = ActionAttempt(kind: .sendMessage, ruleID: rule.id, idempotencyKey: "rule|other-occasion", recipientPersonID: fixtures.sam, payloadDigest: "d", status: .sent, createdAt: birthdayNoon.addingTimeInterval(-30 * 86_400))
        snapshot.actionAttempts[earlier.id] = earlier
        #expect(policy.evaluate(ruleProposal(rule, birthday), approval: nil, context: context(snapshot, unattended: [.sms])) == .deny(["Frequency limit reached"]))
    }

    // MARK: Purchases and outcomes

    func samplePurchase(price: Int64 = 4_500) -> PurchaseDetails {
        PurchaseDetails(item: "Jazz vinyl", merchant: "Example Records", recipientPersonID: fixtures.sam, shippingAddress: "12 Elm St", requestedDelivery: CalendarDay(2026, 11, 9), itemPrice: Money(minorUnits: price, currencyCode: "USD"), tax: Money(minorUnits: 400, currencyCode: "USD"), shipping: Money(minorUnits: 599, currencyCode: "USD"))
    }

    @Test func purchasesNeedTransactionSpecificApproval() {
        let proposal = ActionProposal(kind: .purchase, recipientPersonID: fixtures.sam, recipientAddress: nil, channel: nil, payload: "Jazz vinyl", evidence: [], origin: .user, purchase: samplePurchase())
        #expect(proposal.purchase?.total == Money(minorUnits: 5_499, currencyCode: "USD"))
        #expect(policy.evaluate(proposal, approval: nil, context: context(fixtures.snapshot)) == .requireReview(["Confirm to continue"]))
        let approval = UserApproval(proposalDigest: proposal.digest, approvedAt: birthdayNoon)
        if case .execute = policy.evaluate(proposal, approval: approval, context: context(fixtures.snapshot)) {} else { Issue.record("approved purchase should proceed") }
        var pricier = proposal
        pricier.purchase = samplePurchase(price: 9_900)
        #expect(policy.evaluate(pricier, approval: approval, context: context(fixtures.snapshot)) == .requireReview(["The recipient or content changed after approval"]))
        var mixed = proposal
        mixed.purchase?.shipping = Money(minorUnits: 500, currencyCode: "EUR")
        #expect(policy.evaluate(mixed, approval: UserApproval(proposalDigest: mixed.digest, approvedAt: birthdayNoon), context: context(fixtures.snapshot)) == .deny(["Purchase total is missing or mixes currencies"]))
    }

    @Test func outcomesAreNeverUpgraded() {
        let attempt = ActionAttempt(kind: .sendMessage, idempotencyKey: "k", channel: .sms, payloadDigest: "d", status: .submitted, createdAt: birthdayNoon)
        #expect(ActionOutcomeRecorder.record(.delivered, on: attempt, channel: .none, now: birthdayNoon).status == .sent)
        #expect(ActionOutcomeRecorder.record(.delivered, on: attempt, channel: ChannelCapabilities(reportsDelivery: [.sms]), now: birthdayNoon).status == .delivered)
        #expect(ActionOutcomeRecorder.record(.noResponse, on: attempt, channel: .none, now: birthdayNoon).status == .unknown)
        #expect(ActionOutcomeRecorder.record(.failed("carrier"), on: attempt, channel: .none, now: birthdayNoon).providerStatus == "carrier")
    }

    @Test func giftLinksAndSearchesLeakNothingPrivate() {
        var gift = GiftIdea(personID: fixtures.sam, title: "Record player", url: URL(string: "https://shop.example.com/item/42?ref=abc"), createdAt: birthdayNoon)
        #expect(GiftActions.urlToOpen(gift)?.absoluteString == "https://shop.example.com/item/42?ref=abc")
        gift.url = URL(string: "javascript:alert(1)")
        #expect(GiftActions.urlToOpen(gift) == nil)

        var sam = fixtures.snapshot.people[fixtures.sam]!
        sam.address = "12 Elm St"
        let interests = [
            Fact(personID: sam.id, category: .interest, label: "Interest", value: "jazz vinyl", state: .confirmed, origin: .userAuthored, createdAt: birthdayNoon),
            Fact(personID: sam.id, category: .health, label: "Health", value: "knee recovery", state: .confirmed, origin: .userAuthored, createdAt: birthdayNoon),
            Fact(personID: sam.id, category: .interest, label: "Interest", value: "Sam Rivera fan art", state: .confirmed, origin: .userAuthored, createdAt: birthdayNoon),
            Fact(personID: sam.id, category: .interest, label: "Interest", value: "sailing", state: .unconfirmed, origin: .extracted, createdAt: birthdayNoon),
        ]
        let query = GiftActions.searchQuery(interests: interests, budget: Money(minorUnits: 5_000, currencyCode: "USD"), person: sam) ?? ""
        #expect(query.contains("jazz"))
        #expect(query.hasSuffix("under 50 USD"))
        for leaked in ["sam", "rivera", "elm", "knee", "sailing"] { #expect(!query.lowercased().contains(leaked)) }
    }
}
