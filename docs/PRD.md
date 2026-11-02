# LittleThings.ai Product Requirements Document for Claude Code

Version 2.0 | November 1, 2026 | Product name: LittleThings.ai

*Remember the little things. Show up for the big ones.*

## 1. Build brief

Build a private personal relationship assistant that helps people remember what matters and follow through with friends, family, and selected professional contacts. The core promise is: remember the details, notice the moment, help the user show up.

The product is an iPhone-first native application. Relationship records and inference stay on the user's device. There is no product backend, cloud AI, hosted relationship database, advertising SDK, or mandatory account. The device authenticates its owner locally; it does not grant access to other apps' private data.

This PRD is the implementation authority for a new repository. Use LittleThings.ai throughout the product and developer documentation. The intended domain has not been verified as available or registered, and a similarly named relationship-memory app has been identified. Naming clearance is a launch dependency, not a reason to stop implementation. Do not hard-code ownership of the domain into authentication, email, or service URLs.

Build the full product vision in stages, starting with a useful native iPhone application and an integration feasibility workstream. Social awareness, conversation context, relationship rhythm, gifting, and configurable automation are core intended capabilities. Technical access limitations must be documented as unresolved dependencies with next steps, not converted into permanent product exclusions. Do not substitute a browser dashboard for the native product.

## 2. Problem and opportunity

People care about their relationships but lose details across calendars, messages, conversations, and everyday distractions. They forget to ask how an interview went, follow through on an introduction, plan a birthday early enough, or reconnect while visiting someone's city. A reminder without context often creates guilt rather than connection.

The product should surface a small number of grounded, actionable opportunities with very little maintenance. Automatic capture from supported, permissioned sources is central to its value. Manual notes are a supplement and fallback, not the primary product experience. A manual-only build is a foundation milestone, not validation of the full concept. The app must still provide useful offline functionality when integrations or AI are unavailable.

Primary users: busy adults maintaining relationships across cities and life stages; people carrying family planning responsibilities; people who want help remembering conversational details. Professional contacts are supported, but sales pipelines, lead scoring, and prospecting are out of scope.

### Product principles

- Help users act with care; do not rank the value of people.
- Remember only what the user chooses to capture or explicitly authorizes.
- Every suggested factual claim must have traceable evidence.
- Absence of observed contact is not proof that two people have not spoken.
- Automate preparation. Keep sending, spending, and sharing under human control.
- Deliver utility before asking for broad access.
- Design for fewer useful prompts, not more engagement.

## 3. Product scope and delivery stages

Separate product requirements from platform feasibility. Implement verified routes early; record unavailable routes with specific evidence and an alternative experiment. Do not promise access merely because the user is logged in on a device.

| Stage | Required outcome |
|---|---|
| P0 foundation and feasibility | Native encrypted local vault; selective Contacts and Calendar access; dates, promises, interactions, suggestions, local reminders, editable drafts, local search, backup/restore; text share capture; local AI when supported; capability matrix and tested capture experiments for social and conversation sources |
| P1 low-effort relationship assistant | Local extraction/OCR and voice capture on supported devices; supported recurring imports or direct integrations; evidence-backed life updates and interests; observed relationship rhythm; meeting briefs/follow-ups; travel and shared-interest suggestions; gift planning and Apple Pay merchant handoff; Mac companion if it materially improves authorized capture |
| P2 connected action | Approved direct social/email connectors where feasible; integrated Apple Pay checkout with merchant support; explicitly configured message automation on supported channels; direct device synchronization; optional selective household planning |

These are delivery stages, not permanent feature limits. Move a capability earlier when a verified implementation satisfies privacy, platform, and acceptance requirements. If a channel is blocked, continue with independent work and state the remaining gap precisely. Do not label manual imports or user-shared screenshots as automatic monitoring.

### Firm product requirements

Relationship storage and AI processing remain on the user's devices. No cloud model fallback, relationship-data resale, advertising profiles, credential harvesting, or bypass of access controls. The user chooses sources, people, and automation authority. All sending and spending must be covered by an explicit user action or a narrowly scoped rule; purchases require transaction-specific approval in the initial product. No invented memories or hidden integration failures.

External services are necessary for social retrieval, messaging, and purchases. They receive the minimum information needed for the chosen operation. This does not permit uploading the relationship vault to a company server. Some providers may require server-side credentials or webhooks; document those dependencies and pursue a compatible route rather than quietly weakening the local-only requirement.

### Device authentication and service access

Face ID, Touch ID, or device-owner authentication unlocks the local vault. Provider login authorizes only the access that provider grants. Prefer supported device-side authorization with credentials stored locally; never reuse passwords or extract another app's session. A Mac companion may provide additional permitted integration paths, but is not assumed to unlock arbitrary phone data.

## 4. Core experience

### First session

1. Explain in plain language: information is saved on this device, AI stays local when available, and external actions use the service the user chooses.
2. Create the encrypted local vault and configure device-owner authentication. If the device cannot provide the required protection, explain what must change before real data can be stored.
3. Let the user select a small set of contacts, then choose available sources to connect or share from. Show each source's actual access and freshness. Manual entry remains available without permission.
4. Offer meaningful dates or moments found in authorized data for review. If none exist, offer a quick share, voice memory, or manual entry rather than a long form.
5. Show the first useful card. Request notification permission only after showing its value.
6. Offer backup setup after the first record, with a clear explanation that a lost device without an export may mean lost records.

Recommended onboarding target is 5 to 20 selected people, not an arbitrary enforced limit. The app must work with one person.

### Daily use

The Today screen shows up to three prioritized cards by default, with an optional view of other upcoming items. Every card includes the person, why it appeared, the supporting detail, and a concrete action. Actions are Review, Snooze, Dismiss, and, where appropriate, Done. A user can change the daily card limit or disable suggestions.

Example: "Sam starts his new job today. You noted that he was excited about managing a team." Actions: Draft a message, Remind me tonight, Dismiss. Opening Why this appeared shows the dated source note and allows correction.

### After an interaction

Where access permits, the app processes newly authorized conversation data locally and proposes a concise update without requiring a separate note. A text share extension provides an explicit capture route. As a supplement, the user taps Add memory and types a short note, or uses a verified on-device recording-to-text flow. Example: "Alex's daughter is Maya. Her recital is December 12. I promised to send him the photographer's number."

If local extraction is available, show proposed facts and actions separately. The user can confirm candidates individually or in a batch. An optional source-specific auto-save setting can save explicit non-sensitive details with provenance; ambiguous dates, disputed identities, sensitive details, and external actions require review. Auto-saved records remain labeled as source-derived rather than user-confirmed. The original note is retained unless the user chooses to delete it. Without AI, offer simple manual fields. Never silently turn an ambiguous date into a reminder.

### Before seeing someone

The person page shows recent interactions, important dates, active promises, and user-selected details. If the calendar contains a selected meeting, offer a brief before it. Label it as a scheduled event. Afterward ask whether it happened before logging an interaction.

## 5. Information architecture and visual direction

Use four primary destinations: Today, People, Upcoming, Settings. A persistent Add action supports a person, memory, interaction, date, or promise.

- Today: calm list of actionable cards; no infinite feed or badge of neglected people.
- People: local search, user-defined circles, favorites, city filter, archived people.
- Person detail: short context summary, timeline, dates, preferences, promises, gifts, and boundaries. Show evidence beside inferred or extracted facts.
- Upcoming: chronological list and accessible calendar view of confirmed dates and planned actions.
- Settings: permissions, notifications, local AI availability, privacy, app lock, encrypted backup and restore, export, delete all, and developer diagnostics in development builds.

Visual direction: warm neutral surfaces, restrained color, readable typography, generous spacing, clear native controls, accessible contrast, and dark mode. Use initials when a contact has no image. Avoid enterprise CRM tables and sales vocabulary in user-facing UI. Support Dynamic Type, VoiceOver, reduced motion, and meaningful empty states.

Example empty state: "Add someone you want to remember more about." Example uncertainty: "You last logged a conversation with Jeff on October 8. Have you caught up since?"

## 6. Functional requirements and acceptance criteria

### FR1 People and contact import

Create, edit, archive, and delete a person. Fields: display name, preferred name, relationship label, optional circles, phone numbers, email addresses, city, time zone, address, communication preferences, and notes. All but display name are optional. Addresses are user-entered and are never inferred from social content.

Use supported Contacts APIs with just-in-time permission and selection. Access only what is needed. Contact identifiers are references, not stable cross-device identity. Detect duplicates using normalized phone/email, but merge only after review. A merge preserves evidence and reminders and can be undone within the current session before exit.

Acceptance: permission denial leaves manual use functional; selecting two contacts imports only those two; names and numbers survive restart; revocation stops future reads; deleting a local record does not alter the system address book.

### FR2 Memory and evidence

Support text notes linked to one or more people. Store source type, capture time, event date if known, exact supporting excerpt, confirmation state, and sensitivity flag. Search runs locally. Let users correct, delete, or detach a source. Imported or extracted information retains its source-derived state until reviewed. Optional scoped auto-save reduces repeated data entry without disguising extraction as user confirmation.

Acceptance: every extracted fact links to its source; conflicting dates appear for review; deleting source material triggers review or removal of dependent facts and suggestions. No deleted text remains in search indexes or generated briefs.

### FR3 Important dates

Support birthdays, anniversaries, one-time milestones, custom annual dates, and user-entered dates that require extra care. Year is optional for birthdays. Store date-only values separately from timed events. Ask the user to choose February 28 or March 1 for February 29 reminders in non-leap years. Do not compute age without a birth year.

Defaults: birthday planning reminder 14 days before and day-of reminder; configurable per date. Sensitive dates default to private generic notifications and never trigger celebratory templates. Support multiple milestones per person, snooze, pause, completion for one occurrence, and future recurrence.

Acceptance: correct behavior around year boundaries, time-zone changes, daylight saving, absent birth year, leap day, and missed device execution. Completing this year's birthday does not delete next year's reminder.

### FR4 Promises and follow-through

A promise has owner, associated people, description, optional due date, status, and evidence. Example: "Send Sam the book recommendation." Statuses: open, done, cancelled. A promise without a date remains available but does not become overdue automatically.

Acceptance: completing or cancelling a promise removes related cards and pending notifications; editing the due date reschedules them; extraction cannot invent a commitment the note does not support.

### FR5 Interactions and relationship rhythm

Populate interaction history from verified authorized records where available, supplemented by manual calls, messages, meals, and visits. Distinguish source-observed contact from user-confirmed interaction and calendar plans. Let users choose a reminder cadence, enable observed-pattern suggestions, pause them, or disable them per person. Cadence can use verified observed or confirmed interactions, never drafts or attendance assumptions. Detailed pattern requirements appear in FR14.

Acceptance: "We caught up yesterday" updates the timeline and suppresses cadence suggestions; a message draft does not count as contact; no inferred statement that a friendship is deteriorating. If there is no interaction history, ask the user to establish a baseline rather than invent one.

### FR6 Calendar

Request calendar access only when enabled. Let users select calendars and specific events to associate with a person. Store only the fields needed for selected events, not a mirror of all calendar content. Distinguish business and personal context through user choice; do not infer sensitive relationships from event titles.

Acceptance: cancelled or moved events update relevant reminders when refreshed; denied or revoked permission yields an honest unavailable state; recurring meetings do not generate duplicate cards; attendance is confirmed before logging an interaction. Background refresh is best effort, with a last-refreshed time shown when relevant.

### FR7 Suggestion rules

P0 uses deterministic rules. Eligible candidates: confirmed dates within a lead-time window, dated open promises, confirmed follow-ups, selected upcoming meetings, and user-enabled cadence checks. Rank by time relevance and user preference; use a stable tie-breaker. Do not assign a relationship value score.

Default priority: user-pinned item, time-sensitive confirmed commitment, upcoming date, selected meeting, cadence. Sensitive items require an explicit reminder setting. Deduplicate by person, event/rule ID, and occurrence. Allow at most one unsolicited card per person per day by default; user-pinned actions may remain visible. Cap daily notification digests at one by default, while allowing explicitly scheduled reminders.

Card states: proposed, visible, snoozed, dismissed for occurrence, completed, invalidated. Persist transitions. A dismissed occurrence must not reappear on restart. Snooze must survive time changes without firing twice.

Acceptance: same input and clock produce the same cards; paused people generate none; future or deleted evidence cannot generate cards; a suggestion can explain itself without an AI model.

### FR8 Draft and send

Offer deterministic editable templates first; optional local AI can personalize only from selected confirmed context. Tone options: simple, warm, playful, professional. Never invent memories, feelings, attendance, or closeness. Never include sensitive notes unless the user explicitly selects them for that draft.

Default to a supported system message composer or share flow with recipient and text visible for review. Rule-based sending is a later supported-channel capability governed by FR16; do not assume a system composer permits unattended sending. Do not claim delivery from a handoff. If the system returns sent, record that status precisely; otherwise ask whether the user sent it. Record confirmed send as an interaction only with the chosen outcome.

Acceptance: draft cancel leaves no completed interaction; changed recipient is visible before sending; deleted source invalidates an unsent cached draft; unsupported devices can copy a draft after an explicit user action. Clipboard use is never automatic.

### FR9 Gifts

P0 stores gift ideas, URLs, sizes if volunteered, preferences, budget with currency, and past gifts. Opening a URL requires user action and passes no private notes as query parameters. Apple Pay is the preferred payment method. P0 opens the selected merchant's checkout, where Apple Pay may be offered by that merchant; the app must not imply every merchant supports it. P1 improves gift planning and evaluates participating merchants. P2 can integrate an approved in-app Apple Pay checkout after payment processing and order fulfillment are designed.

Acceptance: no raw card or CVV field exists. A local gift idea works offline. Purchase completion is never inferred from opening a link. Any future in-app checkout shows item, recipient, address, requested delivery date and availability, item price, tax, shipping, currency, full total, and payment approval before commitment. Opening a merchant checkout leaves purchase confirmation to that merchant; the user can manually mark the gift purchased. If an in-app checkout is later added, distinguish authorized, processing, confirmed, failed, cancelled, and refunded states, and prevent duplicate orders on retries. Apple Pay authorizes payment; it does not provide a product catalog, merchant fulfillment, or delivery guarantees.

### FR10 Local notifications

Use local scheduling rather than a remote push service. Default lock-screen content: "You have a relationship reminder." Person names and details require explicit opt-in. Respect quiet hours, user time zone, per-person pauses, and OS permission state. Schedule a bounded rolling window and reconcile it on app activation and after edits; inspect current platform limits before choosing its size.

Acceptance: permission denial does not break Today; duplicate scheduling is idempotent; archived/deleted people have no pending notifications; sensitive text never appears under the private setting. Do not promise exact background execution that iOS cannot guarantee.

### FR11 Export restore and deletion

Provide a versioned, authenticated encrypted backup archive using vetted cryptographic libraries and a separate user-held recovery secret. Do not export the device-bound database key as plaintext. Warn that losing the secret prevents recovery. Explain that an export destination selected by the user may be a cloud drive; recommend a local destination for a strict device-only setup.

P0 restore replaces the local vault only after explicit review and confirmation. Validate archive format, integrity, version, and references in temporary storage before an atomic swap. A bad secret, corrupted archive, or unsupported newer schema leaves the current vault untouched. Merge restore is out of scope.

Delete person: preview dependent items, remove that person's data and derived indexes, and resolve shared notes explicitly. Delete all: clear vault, derived files, pending notifications, and device keys. Explain that copies the user exported or information already sent to another service cannot be erased by this app. Do not promise forensic erasure of flash storage.

Acceptance: export and restore round-trip all supported records; tampering is detected; cancelled restore preserves current data; delete all leaves the app in onboarding with no recoverable app-managed vault key.

### FR12 Source connections and automatic capture

Provide a capability matrix for Contacts, Calendar, LinkedIn, Facebook, Instagram, email, iMessage/SMS, WhatsApp, and desktop capture. For every device/channel record: verified API or import route, required permission, data scope, historical coverage, refresh cadence, regional/account restrictions, on-device feasibility, current status, and next experiment. Status values: verified, prototype, blocked, unavailable, not investigated. Link to current primary documentation and record the verification date.

Preferred capture order: approved direct device-side API; supported local integration; user-authorized export/import; share extension; manual entry. A user-initiated browser extension is a separate feasibility path subject to platform rules. Do not use credential extraction, hidden scraping, or access-control workarounds.

For imports, show format, included people/date range, duplicates, and local storage impact before saving. Imported IDs and content fingerprints make retries idempotent. Revocation stops future capture immediately and offers deletion of existing copies. Source failure affects only that source. An expired login produces a clear reconnect action rather than silently stale recommendations.

Acceptance: every enabled connector proves its actual access on a test account; disconnected connectors transmit nothing; duplicate imports add no duplicate interaction; shared content stays local during parsing. Unsupported sources show honest capability text, not a fake Connect success. P0 must deliver at least text-share capture plus the full matrix and feasibility findings; automatic cross-app monitoring is not considered delivered by that fallback.

### FR13 Life updates and interests

Detect explicit updates in authorized source content: a new job, move, graduation, new family milestone, upcoming performance, or volunteered interest. Link every candidate to a source and its event/capture dates. Resolve identity before associating an update with a person. Distinguish a repost, aspiration, old announcement, or third-party mention from a current event about that person.

A new-job card can offer congratulations; a saved interest can suggest a shared activity or gift. A single like is a weak signal and must not become a confident preference. Let users confirm, dismiss, mute a category, or correct the person. Sensitive inferred attributes are not recommendation inputs. User-supplied sensitive milestones can be remembered with explicit controls.

Acceptance: old announcements do not become new-job alerts; conflicting accounts require review; source timestamps are visible; incorrect identity suppresses action; one event across multiple sources yields one card. Do not invent missing dates.

### FR14 Relationship rhythm

Where sufficient authorized history exists, compare observed contact patterns over time. Initial testable rule: at least eight active conversation days across the previous eight complete weeks, compared with at least 21 days without an observed interaction in a source that remained connected throughout. Treat multiple messages on one day as one active day. Keep parameters configurable for evaluation; they are product hypotheses, not scientific relationship metrics.

Say: "You and Jeff were chatting regularly in the messages you connected. I haven't seen a conversation there in three weeks. Want to check in?" Never claim complete knowledge of all contact. Show covered channels, date range, and freshness. A disconnected source pauses this rule. A manually confirmed recent catch-up resets it. Business-only and group messages should not silently count as personal one-to-one conversation.

Acceptance: inadequate coverage yields no pattern claim; reconnecting does not trigger stale alerts before refresh; an explicit pause suppresses all cadence prompts; an observed lull is not labeled relationship decline.

### FR15 Contextual planning and thoughtful action

Combine authorized calendar events, user-entered travel, confirmed locations/interests, and local history to offer meeting briefs, follow-ups, introductions, shared activities, and gifts. Examples: "You'll be in Chicago next week; want to see Alex?" or "You promised to introduce Sam to a designer." Match people and dates with evidence. Ask before making an introduction or sharing another person's details.

For gift discovery, derive a short non-identifying query locally, preview external searches when needed, and avoid sending the underlying conversation. Maintain recipient preferences, shipping lead time, budget, currency, and prior gifts. Use Apple Pay at supported merchant checkout initially. Integrated checkout must satisfy FR9 and remain distinct from vault storage.

Acceptance: a planned calendar meeting is not an attended meeting; trips and cities are current or explicitly marked uncertain; no duplicate gift suggestion for an already-given item; no automatic address disclosure to gift search services.

### FR16 Configurable message automation

Automation is an intended capability, enabled only for channels with verified sending support. Default to review before sending. Later allow users to authorize narrowly scoped rules with named recipients, channel, trigger, approved template or bounded personalization, time window, expiry, frequency limit, and permitted source context. Show example output before activation. Offer a global pause, per-rule pause, preview queue, and local action history. Changing recipient, scope, or content permissions requires renewed approval.

Examples: an approved birthday template to selected family members, or an approved follow-up after the user marks a meeting completed. Newly detected sensitive events and uncertain identities always require review. Automated purchases are not authorized by a message rule. Apple Pay payment remains transaction-specific approval unless a separately designed and explicitly authorized future payment model is introduced.

Validate permission, recipient, evidence freshness, rule expiry, source deletion, and deduplication immediately before execution. Do not queue surprise sends after long offline periods: expire missed windows and request review. Use idempotency when the channel supports it. If send outcome is unknown and duplication cannot be ruled out, do not retry blindly. Record submitted, sent, delivered only when actually reported, failed, cancelled, or unknown separately. Explain that a sent message may not be recallable.

Acceptance: rule disabled before execution sends nothing; duplicate triggers produce one submission; unavailable unattended-send APIs fall back to review; AI cannot modify the allowlist or approve itself; source-content prompt injection cannot send messages; an ambiguous result never becomes a claimed successful delivery.

## 7. Local intelligence contract

Use Apple's on-device model only after runtime capability checks. Device support, installed model availability, OS version, and language may differ. If unavailable, use manual entry and deterministic templates. Never call cloud models, including a privacy-branded remote service, as a fallback.

Model output is untrusted structured data. Validate against a schema and require references to supplied evidence. Missing dates stay missing. Ambiguous phrases such as "next Friday" require a capture date and user confirmation. Distinguish explicit statements from possible interpretations; prefer confirmation states over misleading numeric confidence percentages.

Treat notes, shared posts, imported content, and OCR as data, never instructions. Model output cannot directly send, purchase, delete, or access secrets. A deterministic action policy may execute a validated proposal only under the user's explicit approval or active scoped rule. Imported text can never create or expand that authority. Retrieved evidence is limited to the selected person and action, preventing unrelated private details from leaking into drafts. No training or remote feedback upload.

For voice input, only advertise local transcription when the implementation guarantees on-device processing on that configuration. Otherwise omit the in-app microphone path and support typed input. Do not imply that a third-party keyboard's dictation behavior is controlled by this app. If recording is supported, show an obvious recording state and delete raw audio after transcription by default.

## 8. Architecture and proposed stack

Use Swift and SwiftUI with a deployment target selected after checking the installed Xcode SDK and required APIs. Document the chosen minimum OS and test matrix. Keep the core app usable on the declared minimum without local AI. Use Contacts, EventKit, UserNotifications, LocalAuthentication, and a supported messaging composer where available.

Recommended persistence: encrypted SQLite through a maintained SQLCipher-compatible layer. Verify licensing, build compatibility, migration support, and encryption configuration before adopting a package. Do not claim that unencrypted SwiftData or ordinary SQLite meets the vault requirement. Use device-bound Keychain protection for vault keys and platform file protection for database, journals, attachments, indexes, and temporary files. If the vault cannot unlock, fail closed without plaintext fallback.

Suggested modules:

- AppShell and Feature views: UI and navigation.
- Domain: records, rules, policies, use cases, no UI dependencies.
- Vault: encrypted persistence, migrations, keys, backup and restore.
- SuggestionEngine: deterministic candidates and state transitions.
- Integrations: contacts, calendar, notifications, message handoff, capability checks.
- LocalIntelligence: availability, extraction, drafting, schema validation.
- TestSupport: fake clock, mock permissions, fake providers, synthetic fixtures.

Use protocol boundaries for integrations and dependency injection for tests. Avoid global mutable singleton state. Keep plaintext summaries, embeddings if later introduced, and search indexes inside encrypted storage. Avoid a separate unencrypted full-text index. P0 can use local string search until indexing is justified.

The core vault and inference require no network. Introduce device-side network adapters only for explicitly enabled, verified integrations. Maintain a per-adapter list of destinations, data fields sent, permissions, and retention behavior. External browser or composer actions are explicit handoffs. Dependencies must not introduce telemetry. Authorization tokens belong in device-only Keychain storage; never share sessions or credentials with a product backend. Refresh is best effort under platform scheduling limits, with stale-source indicators.

Add CapturePipeline, IntegrationCapabilityRegistry, and ActionPolicy modules. CapturePipeline normalizes authorized records into evidence before extraction. IntegrationCapabilityRegistry records per-device capabilities and last successful refresh. ActionPolicy validates user authority and current conditions before any outbound action; a model cannot grant itself authority.

## 9. Data model

Use UUID identifiers, schema versions, creation/update timestamps, and explicit foreign keys. Store timestamps in UTC and local date semantics separately. Do not log record contents.

| Entity | Required information |
|---|---|
| Person | ID, name, optional contact reference, contact fields, circles, city/time zone, archive state, reminder preferences |
| Source | ID, source type, captured timestamp, optional event date, original text or encrypted attachment reference, sensitivity, selected person links |
| Fact | ID, person ID, field/value, source reference and excerpt, confirmed/unconfirmed/disputed state, optional validity dates |
| ImportantDate | ID, person ID, category, date components, optional year, recurrence policy, leap-day choice, notification settings, source |
| Interaction | ID, person links, type, occurred timestamp, confirmation state, optional source and summary |
| Promise | ID, person links, owner, description, optional due time, status, source |
| CalendarLink | ID, selected calendar/event reference, person link, cached permitted fields, last refresh, attendance state |
| GiftIdea | ID, person ID, description, optional URL, budget/currency, occasion link, planned/purchased/given state |
| Suggestion | ID, rule ID, person ID, evidence references, occurrence key, reason, scheduled time, state, snooze time |
| Draft | ID, suggestion/person link, selected evidence, editable text, handoff/outcome state, timestamps |
| Preferences | Locale/time zone behavior, quiet hours, card limit, app lock, notification privacy, integration choices |
| Connection | Provider, authorized scope, local token reference, coverage, freshness, capability status, revocation state |
| CaptureRecord | Provider record ID/fingerprint, selected people, source linkage, import batch, extraction state |
| InterestOrLifeEvent | Person, category, evidence, event date, explicit/inferred state, confirmation, freshness |
| AutomationRule | Named recipients, channel, trigger, template/context scope, expiry, limits, active state, approval record |
| ActionAttempt | Rule or approval reference, idempotency key, recipient, payload reference, timestamps, provider status, outcome |

Index source dependencies so edits and deletion invalidate derived records. Distinguish user-authored facts that remain valid independently from extracted facts whose source has been removed. Do not silently retain deleted source excerpts inside summaries.

## 10. Privacy and security acceptance gate

Threat model includes a lost locked device, shoulder surfing, lock-screen disclosure, accidental exports, malicious imported text, dependency telemetry, and accidental plaintext logs. A compromised operating system or someone with an unlocked device is outside the protection guarantee; app lock reduces exposure but is not an absolute barrier.

Required before real-user beta:

- Encrypted vault and attachments with keys protected by device authentication policy.
- Reauthentication on cold launch and after the configured background timeout; obscure app-switcher snapshots.
- No private content in logs, crash reports, filenames, notification identifiers, analytics, or clipboard without action.
- Explicit exclusion of vault and sensitive app files from automatic backup where platform controls support it; verify device-key migration and backup behavior. Strict local-only privacy cannot be claimed until this is tested.
- No remote crash reporting, analytics, model requests, or contact synchronization.
- Network inspection on a physical device with real integrations disabled: no app-originated relationship-data traffic. Document OS-level activity separately rather than claim the entire phone is offline.
- Denied and revoked permissions tested for every integration.
- Encrypted exports tested for corruption, wrong secret, migration, and interrupted writes.
- Per-person privacy controls, generic notifications, pause reminders, and permanent deletion.

Calendar and contacts may already originate in the user's iCloud or Google accounts. The promise concerns this app's copies and processing; it cannot change how source services store their own data.

## 11. Quality and validation

Use synthetic people only in development fixtures. Seed a demo explicitly marked Demo, never mix it with real records. Suggested fixtures: Sam with a confirmed new job; Jeff with a stale logged interaction; Maya with a birthday lacking a birth year; Alex with an open promise; Rachel with a sensitive date; two people with similar names and different numbers.

Required automated tests focus on meaningful failure modes: recurrence, time zones, suggestion deduplication, pause/dismiss persistence, source invalidation, wrong-recipient prevention, permission denial, export integrity, migration, and local-only fallback. UI tests cover onboarding without permission, add person/date/promise, review draft, cancel send, pause person, export/restore, and delete.

On physical supported hardware, verify app lock, notifications, Contacts and Calendar selection, message handoff, AI availability and unavailability, offline use, accessibility, and vault protection. Simulator results alone do not establish device privacy or messaging behavior.

Proposed performance targets, to measure rather than claim: first meaningful screen within two seconds with 1,000 people and 20,000 notes on the declared reference device; local search p95 under 300 ms after warm-up; UI remains responsive during imports and local inference. Paginate long timelines. Cancel model work when the user leaves its screen.

## 12. Success measures and product validation

The primary outcome is useful follow-through, measured through user-confirmed actions and qualitative feedback. A copied draft or opened composer is not evidence of an improved relationship.

Keep product counters local by default. Pilot participants may voluntarily export a previewed diagnostic summary without names, notes, dates, addresses, or message contents. No silent analytics pipeline.

Suggested pilot: 10 to 15 consenting adults for four weeks. Working hypotheses, not established benchmarks: most can select five people and reach one useful sourced suggestion within five minutes; at least half report one useful action per week; at least 70% of rated suggestions are useful; unwanted or factually wrong suggestions remain rare and explainable. Any unauthorized transmission, wrong-person action, or sensitive notification leak blocks release regardless of engagement.

Track capture effort locally: manual edits per useful action, share/import steps, percentage of suggestions grounded in authorized capture rather than hand-entered notes, and integrations that repeatedly fail. Ask whether the product saves mental effort. High reminder usage with heavy data entry is not sufficient validation.

Interview for willingness to pay only after repeat usefulness. Test a subscription or paid app model without advertising, data resale, or commissions that distort gift recommendations. Pricing is not decided in this PRD.

## 13. Implementation sequence for Claude Code

### Phase 0 Repository and integration feasibility

Read repository instructions, inspect existing code, identify Xcode/toolchain availability, and create an implementation plan. Verify current primary documentation for APIs and constraints before implementation. Record OS targets, encryption dependency choice, local AI availability, and unsupported capabilities in a decision log. If running without macOS/Xcode, implement reviewable source and tests where possible, but report native compilation/device testing as blocked. Never claim a runnable validated iPhone build from a web preview.

Complete the FR12 capability matrix and prioritize experiments for automatic social updates, conversation capture, local extraction, and verified sending. Record what has been tested, which permissions are required, and the best current alternative for every blocked route. Continue independent implementation while provider approvals are pending.

### Phase 1 Private foundation

Create native app structure, encrypted vault and key handling, schema/migrations, manual people/notes, app lock, settings, and synthetic demo fixtures. Gate: persistent records survive restart and cannot be read from the database as plaintext; manual operation works without permissions and network.

### Phase 2 Useful daily loop

Implement dates, promises, interactions, deterministic suggestion engine, Today, Upcoming, snooze/dismiss/pause, and local notification scheduling. Gate: all date and rule edge-case tests pass and every card explains its evidence.

### Phase 3 Permissioned assistance

Add selective Contacts and Calendar flows, text-share capture, editable templates, message composer handoff, and local AI behind runtime checks. Implement verified automatic capture paths as soon as feasible rather than waiting for a nominal stage label. Gate: denial/revocation/cancellation produce accurate states; no invented interactions or hidden cloud calls.

### Phase 4 Recovery and release validation

Complete encrypted export/restore, deletion, accessibility, privacy inspection, performance measurements, and device verification. Gate: full P0 acceptance criteria pass or remaining blockers are explicitly documented. Do not mark a phase complete because UI placeholders exist.

### Phase 5 Low-effort capture and connected action

Implement the verified FR12–FR15 routes and measure how much manual maintenance remains. Add local Mac support if it unlocks material authorized capture capability. Implement FR16 only on channels with proven send semantics. Add integrated Apple Pay only with a functioning merchant/payment flow. Gate: evidence-backed automatic capture works for the stated source coverage; privacy and action-policy tests pass; unavailable capabilities remain explicitly tracked. A manual-only prototype does not satisfy this gate.

### Required repository deliverables

- Native application source and reproducible project setup.
- This PRD at docs/PRD.md.
- README with supported environments, setup, build/test commands, limitations, and local-data behavior.
- Architecture and privacy decision records.
- Integration capability matrix, tested feasibility findings, and next experiment for each unresolved route.
- Action-policy specification and source coverage visible in the app.
- Unit and UI tests with synthetic fixtures.
- Acceptance checklist marking each requirement passed, failed, or not tested, with evidence.
- A short handoff listing completed scope, commands actually run, unverified device behavior, and next work.

## 14. Cross-device and service integration requirements

A Mac companion may offer convenient capture and direct transfer, but does not automatically unlock messaging or social data. Prototype direct pairing and encrypted transfer separately; define conflict resolution before claiming sync. P0 has one authoritative device and encrypted manual export, not synchronization.

Future social integrations must document the exact approved API, permitted data, permission model, refresh behavior, retention, and platform terms. The app should remain useful if an integration disappears. A browser extension or user-export import requires its own feasibility review. Never bypass access controls or assume a logged-in session grants unlimited extraction rights.

Future shared household planning must be opt-in per record and recipient, with preview, revocation semantics, and a clear explanation that already-shared copies may persist. Never expose private relationship notes simply because two users are spouses or family.

Future in-app gift checkout should use Apple Pay with a supported payment processor and explicit purchase approval. Do not store raw card numbers or CVVs. Merchant/payment infrastructure is external to the local relationship vault and requires a separate integration design; do not secretly add a backend to P0. Recipients, addresses, and order details necessarily leave the device for fulfillment. This is an action-specific disclosure, not a transfer of the relationship vault.

## 15. Primary references to verify during implementation

These sources support platform constraints discussed during planning. API availability, regional restrictions, entitlements, licensing, and OS support must be checked against the actual development environment.

- Apple on-device generation: https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models
- Apple Contacts and privacy controls: https://support.apple.com/guide/iphone/control-access-to-information-in-apps-iph251e92810/ios
- Apple EventKit permissions: https://developer.apple.com/documentation/eventkit/accessing-the-event-store
- Apple messaging access discussion: https://developer.apple.com/forums/thread/804040
- Apple carrier messaging framework: https://developer.apple.com/documentation/telephonymessagingkit
- LinkedIn API access: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Meta Instagram API documentation: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Apple Pay planning: https://developer.apple.com/apple-pay/planning/

## 16. Paste this instruction into Claude Code

Read docs/PRD.md in full and build LittleThings.ai, a native, private relationship assistant. Use the name LittleThings.ai throughout, without assuming its domain is owned. Preserve the full vision: low-effort capture, life updates, conversation context, relationship rhythm, calendar follow-through, gifts with Apple Pay, and configurable action rules. Manual entry is a fallback, not the intended core experience.

Inspect the repository and its instructions, verify the available toolchain, and create a phased implementation checklist. Start the integration feasibility workstream immediately alongside the private local foundation. Verify current primary documentation for each provider, record capability status and evidence, and implement supported routes. Do not turn an unresolved API question into a permanent product exclusion, and do not fabricate access or bypass platform controls. Keep relationship storage and inference local. External service actions may use only the data necessary for the user's authorized operation.

Build P0, then continue through feasible P1 and P2 capabilities in dependency order. Use synthetic test data. Implement approved-scope automation only on verified channels and keep purchase authorization explicit. Never add a cloud model fallback, hosted relationship vault, or raw credit-card storage. Use the proposed stack unless a concrete incompatibility requires a documented substitution. Run available checks and record actual results. If macOS/Xcode, provider approval, or device verification is unavailable, deliver reviewable source, the precise blocker, and the next verification step without claiming completion. Continue independent work instead of stopping at a plan. Ask only about decisions that cannot reasonably be resolved from this PRD.
