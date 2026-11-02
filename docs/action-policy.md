# Action policy specification

Implementation: `Sources/LTPolicy/ActionPolicy.swift`. Tests: `Tests/LTPolicyTests`.

The action policy is a deterministic function that every outbound action passes through before
LittleThings hands anything to another service:

```
evaluate(proposal, approval?, context) → execute(attempt) | requireReview(reasons) | deny(reasons) | expired(attempt)
```

## Principles

1. **Authority never comes from content.** Notes, shared posts, imports, OCR and model output are
   data. A `ProposalOrigin.model` proposal can only ever produce `requireReview`.
2. **Authority comes from exactly two places:**
   - a `UserApproval` bound by digest to the exact kind, recipient, address, channel, payload and
     (for purchases) item, merchant, recipient, address, delivery date, price, tax and shipping;
     approvals expire after 5 minutes; or
   - an active, approved, in-scope `AutomationRule` on a channel with **verified** unattended-send
     support (none in this build).
3. **Purchases always need transaction-specific approval.** A rule can never buy anything.
4. **Careful (sensitive) dates are never automated.**
5. **No surprise sends.** Missed windows expire and ask for review; nothing is queued for later.
6. **No blind retries.** An attempt with an unknown outcome blocks retries for that occasion.
7. **Never upgrade uncertainty.** Delivery is recorded only when the channel reports it.

## Checks performed for every proposal

| Check | Outcome on failure |
|---|---|
| Recipient person exists | deny |
| Recipient not archived | review |
| Address belongs to the recipient (normalized phone / email match) | review |
| All evidence still exists (deleted sources invalidate pending actions) | deny |
| Approval digest matches the current proposal | review ("changed after approval") |
| Approval not expired | review |
| Purchase total computable in a single currency | deny |

## Additional checks for automation rules (FR16)

Evaluated in this order:

| Check | Outcome |
|---|---|
| Rule exists | deny |
| Idempotency key `rule|recipient|occurrence` already used | deny ("already handled"); unknown outcome → deny ("not retrying") |
| Global automation pause | review |
| Rule paused | review |
| Approval present and scope digest equals the rule's current scope | review ("needs your approval again") |
| Rule not expired | review |
| Recipient and address in the rule's allowlist | review |
| Channel equals the rule's channel | review |
| Recipient's reminders not paused | review |
| Trigger: annual date exists, is confirmed, not sensitive, not `.careful` | deny / review |
| Trigger: occurrence day is today (past → **expired**, future → review) | expired / review |
| Trigger: meeting confirmed attended, within 2 days | deny / expired |
| Local time inside the rule's window | review |
| Frequency limit not exceeded (counts submitted/sent/delivered/unknown) | deny |
| Payload equals the rendered approved template (or starts with it when bounded personalization is allowed) | review |
| Channel has verified unattended-send support on this device | review |

## Scope digest

`AutomationScope.digest(rule)` hashes recipients (person + address), channel, trigger, template,
personalization flag, permitted context categories, time window, expiry and frequency limit.
`AutomationScope.approve(rule, previewedExample:now:)` is the only function that sets an approval,
and it is called only from the review screen after the user has seen example output. Any edit to
scope — by the user, a bug, a merge or a deletion — changes the digest and voids the approval
(`MergePlanner` and `DeletionPlanner` also clear approvals explicitly and pause the rule).

## Outcomes

`ActionOutcomeRecorder.record` maps provider reports to `ActionAttemptStatus`:

| Provider report | Recorded |
|---|---|
| accepted | submitted |
| sent | sent |
| delivered | delivered only if the channel reports delivery, else sent |
| failed(reason) | failed (+ provider status) |
| cancelled | cancelled |
| no response / timeout | unknown (never retried automatically) |

The vault enforces `UNIQUE(idempotency_key)` on action attempts, so a second submission for the
same occasion cannot be persisted even if the policy were bypassed.

## Message handoff today (FR8)

The user's tap on "Open in Messages / Mail" with recipient and text visible is the approval. The
system composer is the final review: the user taps Send there. `MessageComposeResult.sent` is
recorded as `systemReportedSent` (never "delivered"). Share-sheet and copy handoffs record
`handedOff` and then ask "Did you send it?". Only `systemReportedSent` or `userConfirmedSent`
creates an interaction. Clipboard writes happen only on an explicit "Copy text" tap.

## Gifts (FR9, FR15)

- `GiftActions.urlToOpen` returns exactly the URL the user saved, only for http(s); nothing is
  appended and opening never marks a gift purchased.
- `GiftActions.searchQuery` builds a short query from confirmed, non-sensitive interest words,
  excluding names, addresses and notes, with an optional budget.
- There is no card or CVV field anywhere (enforced by `scripts/privacy-guards.sh`). In-app Apple
  Pay checkout is not built: it requires a merchant ID and payment processor, which is a server
  dependency recorded as blocked in the capability matrix.

## Enabling a channel later

To enable unattended sending on a channel, all of the following must be true and documented:
the channel's send semantics are verified on a device (capability matrix row moved to
`verified` with `tested_in_app: true`), the adapter reports outcomes faithfully, idempotency is
supported or duplicates are provably impossible, and `ChannelCapabilities.unattendedSend` is set
for that channel only.
