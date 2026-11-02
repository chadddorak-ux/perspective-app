# Architecture

LittleThings.ai is an iPhone app backed by a platform-independent Swift package. All logic
that can be expressed without Apple UI frameworks lives in the package and is tested on Linux
and macOS; the app adds SwiftUI and thin adapters to Apple frameworks.

```
┌─────────────────────────────── App/ (iOS, SwiftUI) ─────────────────────────────────┐
│  Features: Onboarding · Today · People · Person · Add · Review · Upcoming · Settings  │
│  Platform adapters: Keychain · LocalAuthentication · FileProtection · Notifications   │
│                     Contacts picker · EventKit · MessageUI/Mail · Foundation Models   │
│                     Speech (on-device only) · Vision OCR                              │
│  ShareExtension: seals shared items to the app's public key (HPKE) → App Group inbox  │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │ AppEnvironment (protocols, injected)
┌──────────────────────────── LittleThingsKit (Swift package) ─────────────────────────┐
│ LTAppCore      @Observable AppModel: lock/unlock, demo, commit→refresh, flows        │
│ LTSuggestions  deterministic rules, tiers, card states, rhythm (FR14)                │
│ LTIntegrations capability registry (FR12), notification planner, calendar/contacts  │
│ LTIntelligence untrusted extraction schema, validator, pattern extractor, drafts     │
│ LTCapture      share inbox (HPKE), capture pipeline, WhatsApp/LinkedIn importers     │
│ LTPolicy       action policy, rule scope digests, outcome recording, gift actions    │
│ LTVault        SQLCipher store, migrations, backup archive, atomic restore           │
│ LTDomain       records, CalendarDay math, recurrence, deletion/merge planning        │
│ LTCryptoSupport CryptoKit (Apple) / swift-crypto (Linux)                              │
│ LTTestSupport  fixtures, fake clock, fakes for every platform protocol               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Data flow

1. **Capture.** A note, share, voice transcript, OCR text, contact pick, calendar link or import
   becomes a `Source` (original retained) — `CapturePipeline` / `ContactImportPlanner` /
   `ImportPlanner`. Imports are previewed (format, people, date range, duplicates, storage)
   before anything is saved, and are idempotent through `(provider, fingerprint)`.
2. **Extraction.** `PatternExtractor` or the on-device model produces `RawExtraction`
   (untrusted). `ExtractionValidator` grounds each item in the source and returns an
   `ExtractionProposal`; nothing is saved until the user confirms (or a scoped auto-save saves
   explicit, non-sensitive facts/dates as *unconfirmed*).
3. **Records.** Confirmed items become `Fact`, `ImportantDate`, `Promise`, `LifeEvent` with
   `sourceID` + `excerpt` provenance. All writes are `[RecordChange]` applied atomically to the
   vault and the in-memory `VaultSnapshot`.
4. **Suggestions.** After every commit, `SuggestionEngine.evaluate(snapshot, context)` produces
   Today's visible cards, "More", and state changes (new records, snooze expiry, invalidation).
   Same snapshot + clock ⇒ same cards.
5. **Notifications.** `NotificationPlanner.plan` produces a bounded set of opaque, generic
   notifications; `reconcile` diffs against pending ones on every refresh.
6. **Action.** Drafts are composed from templates using only selected confirmed context.
   `ActionPolicy` gates every handoff; the system composer is the final review.

## Key invariants (all tested)

- Source-derived facts always carry a source and an exact excerpt.
- Deleting a source removes unconfirmed derived records (or keeps confirmed ones as the user's
  own notes without the excerpt), invalidates cards and unsent drafts, and leaves no text in
  search (search scans the live snapshot; there is no separate index).
- A transaction can never commit an orphan (deferred foreign keys).
- Dismissed/completed occurrences never reappear; snoozes are absolute instants.
- Date-only values are interpreted in the user's current time zone; timed values are absolute.
- No model output, imported text or note can authorize an action.

## Persistence

See decision-log D4–D7. One SQLCipher file holds everything, including attachments. The vault
key is a random 256-bit key in a device-only, user-presence Keychain item. Backups are AES-GCM
archives keyed from a user-held recovery key; restore is staged, verified and atomically swapped.

## Testing

| Target | Focus | Tests |
|---|---|---|
| LTDomainTests | calendar math, DST, leap day, recurrence, duplicates, merge/undo, deletion planning | 24 |
| LTVaultTests | encryption at rest, wrong key, FK atomicity, migrations, newer schema, backup/restore, tamper, interrupted writes | 25 |
| LTSuggestionsTests | ranking, determinism, pause, dismiss/snooze persistence, per-person cap, evidence validity, year boundary, time zones, meetings, life updates, travel, rhythm | 33 |
| LTIntegrationsTests | capability catalog honesty, notification privacy/idempotency/window, calendar reconciliation, contact import | 20 |
| LTIntelligenceTests | date parsing, grounding, invented content rejection, prompt injection, ambiguity, drafts, personalization guard, briefs | 21 |
| LTCaptureTests | HPKE inbox, idempotent capture, WhatsApp/LinkedIn import, rhythm from imports, revocation | 11 |
| LTPolicyTests | approvals, recipients, rules, scope, dedupe, unknown outcomes, expiry, purchases, gifts | 15 |
| LTAppCoreTests | end-to-end flows: onboarding without permissions, restart, relock, demo, memory review, drafts, pause, delete, share inbox, backup, delete-all, merge undo, imports, calendar, search, contacts, conflicting dates; opt-in performance benchmark | 20 (+1 opt-in) |

UI tests (`App/LittleThingsUITests`) cover onboarding without permission, add person/date/promise,
draft cancel, pause, demo, backup start and delete-all; they run in CI on a simulator but are
non-blocking until stabilized.
