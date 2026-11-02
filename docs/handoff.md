# Handoff — 2026-11-02

Branch: `claude/littlethings-foundation` · Product: LittleThings.ai · PRD: `docs/PRD.md` v2.0

## Completed scope

**Phase 0 — feasibility and decisions**
- PRD committed verbatim; decision log (`docs/decision-log.md`, D1–D16): iOS 18 minimum,
  Swift 6, SQLCipher via Zetetic SwiftPM 4.20.0 (license and package verified), backup format,
  on-device-only AI, HPKE share inbox, capture strategy, notification limits.
- FR12 capability matrix: 44 routes across Contacts, Calendar, LinkedIn, Facebook, Instagram,
  email, iMessage/SMS, WhatsApp, desktop capture and platform capabilities, each with status,
  permissions, scope, restrictions, backend dependency, cited docs (checked 2026-11-02) and a
  next experiment. Bundled into the app as the Sources screen catalog.

**Phases 1–4 — private foundation, daily loop, permissioned assistance, recovery** (core
package, all tested)
- Encrypted SQLCipher vault with migrations, deferred FKs, fail-closed key handling, attachments.
- Domain model for all PRD §9 entities plus trips; date-only semantics; recurrence; leap-day
  choice; deletion and merge planning with undo.
- Deterministic suggestion engine (FR7) with explanations, card states, per-person cap; rhythm
  (FR14); life updates (FR13); travel overlap (FR15); meeting briefs and attendance (FR6).
- Notification planning and reconciliation (FR10).
- Extraction contract: untrusted schema, grounding validator, deterministic pattern extractor,
  prompt builder; drafts and personalization guard (FR8); meeting briefs.
- Capture: HPKE share inbox, idempotent capture, WhatsApp chat export and LinkedIn
  `Connections.csv` imports with preview and revocation.
- Action policy (FR8/FR9/FR16) with scope digests, idempotency, expiry and outcome recording.
- Encrypted backup/restore with recovery key, staged atomic restore (FR11); delete person /
  delete everything.
- `@Observable` `AppModel` with lock/unlock, background relock, demo vault, and every flow above.

**Native app** (`App/`, compiled in CI for the iOS Simulator; not run on a device)
- SwiftUI: onboarding (PRD §4 first session), lock screen and app-switcher privacy shield, Today
  with "Why this appeared", drafts with policy-checked Messages/Mail handoff, People, person
  page with evidence, Add flows (memory with grounded review, person, date with leap-day choice,
  promise, conversation, gift, trip, calendar event), review queue, Upcoming with accessible
  month grid, Settings (privacy, lock, reminders, suggestions, AI availability, Sources, backup,
  restore, imports, delete everything, debug diagnostics).
- Adapters: Keychain (device-only, user presence), LocalAuthentication, file protection,
  UserNotifications, Contacts picker + limited/full access re-reads, EventKit, MessageUI/Mail,
  Foundation Models (`SystemLanguageModel.default` only), on-device Speech, Vision OCR.
- Share extension (HPKE sealing into the App Group; no vault access).
- UI tests for the PRD §11 flows.
- CI (`.github/workflows/ci.yml`) and `scripts/privacy-guards.sh`.

## Commands actually run (results)

| Command | Where | Result |
|---|---|---|
| `swift build --build-tests` / `swift test` | Local Linux container (Swift 6.4.2, SQLCipher 4.5.6) | 169 tests in 8 targets, all passing (plus an opt-in benchmark) |
| `swiftc -parse` on all 19 app Swift files | Local Linux | All parse |
| `./scripts/privacy-guards.sh` | Local and CI | Pass; also verified it fails on a planted probe |
| CI `core-linux` (`swift:6.4.2-noble`) | GitHub Actions | Pass |
| CI `swift test` on `macos-latest` (CryptoKit + Zetetic SQLCipher binary) | GitHub Actions | Pass |
| CI `swift test` on macOS | GitHub Actions | "Test run with 168 tests in 16 suites passed" (run 3; before the FR2 conflict test was added) |
| CI `xcodegen generate` + `xcodebuild … iOS Simulator build` (Xcode 26.6, iOS 26.5 SDK) | GitHub Actions | Runs 1–2 failed on Swift 6 concurrency diagnostics in the Contacts/MessageUI adapters (non-Sendable static; delegate conformances); fixed; **BUILD SUCCEEDED** from run 3 onward |
| CI UI tests on an iPhone simulator (7 tests) | GitHub Actions | Run 3: 3/7; run 4: 5/7; run 5: 6/7; **run 6: 7/7 passing** (fixes were test selectors and lazy-Form scrolling, not app logic) |
| `LT_PERF=1 swift test -c release … --filter PerformanceTests` | Local Linux | load 0.33 s, engine 11 ms, search p95 129 ms (was 449 ms before the corpus fix) |

## Unverified device behavior (must be checked on a physical iPhone)

1. Vault key Keychain item: creation with/without passcode, Face ID/Touch ID/passcode prompts,
   cancel/failure paths, deletion on delete-all, behavior after device migration or restore from
   an iCloud/Finder backup (the vault directory is excluded from backup; the key is device-only).
2. File protection `.complete` and `isExcludedFromBackup` actually applied to the vault directory.
3. App-switcher snapshot is obscured; relock after the configured timeout.
4. Contact picker returns only selected contacts without a permission prompt; limited access.
5. EventKit full-access prompt, revocation in Settings, recurring occurrence lookup.
6. Local notifications fire at the right wall-clock time across time-zone changes and DST;
   generic text on the lock screen; pending count stays ≤ 48.
7. Messages/Mail composer handoff and result reporting; share sheet and copy.
8. Foundation Models availability states (eligible/ineligible/off/not ready), `supportsLocale`,
   extraction quality and latency within the 4,096-token context.
9. On-device speech: microphone path only appears when on-device recognition is supported;
   raw audio deleted after transcription; airplane-mode check.
10. Vision OCR runs offline (airplane mode).
11. Share extension: activation for text/URL/files, App Group key handoff, memory limits,
    WhatsApp "Export chat" file type (`.txt` vs `.zip`).
12. Network inspection with integrations disabled: no app-originated traffic.
13. Accessibility audit: Dynamic Type at the largest sizes, VoiceOver order and labels,
    reduced motion, contrast in both appearances.
14. Performance at 1,000 people / 20,000 notes on the reference device. (Linux container
    release build: load 0.33 s, engine 11 ms, search p95 129 ms after a 0.17 s corpus build.)

## Known gaps and next work (in dependency order)

1. **Run the app on a physical iPhone** (it already builds and runs in the simulator in CI); work
   through the list above, then update the acceptance checklist. Consider making the UI-test CI
   step blocking once it has been stable for several runs.
2. **First automatic capture route** (Phase 5): prototype Gmail metadata on-device (AppAuth/PKCE,
   `gmail.metadata`, testing mode) → observed interactions per contact with honest coverage;
   then Microsoft Graph `Mail.ReadBasic`. Each needs a device-side network adapter with a
   documented destination/field list and a privacy-guard exception scoped to that adapter.
3. **Shortcuts personal-automation experiment** (matrix experiment #8) to see whether a
   user-built automation can send an approved template without confirmation; if yes, design an
   App Intent that returns policy-approved text, and only then set `unattendedSend` for it.
4. **Automation rule UI** (create, preview example, approve, pause, history) on top of the tested
   policy.
5. **Conflict detection** for dates and life updates across sources (FR2/FR13 partial).
6. **Mac companion** feasibility (ScreenCaptureKit + Vision OCR, user-initiated) and direct
   encrypted transfer; Messages database via Full Disk Access is a product/legal decision (matrix:
   blocked, "not considered API" per Apple DTS).
7. **Apple Pay in-app checkout** requires a merchant ID and payment processor (server) — blocked;
   merchant handoff is what ships.
8. **Pilot instrumentation**: local counters and a previewed, anonymized diagnostic export (PRD §12).
9. Introductions / shared-activity suggestions (FR15 remainder); SpeechAnalyzer on iOS 26+.

## How to continue

```sh
swift test                      # core (macOS or Linux with libsqlcipher-dev)
./scripts/privacy-guards.sh
cd App && xcodegen generate && open LittleThings.xcodeproj
```

Set `LT_BUNDLE_PREFIX` and `DEVELOPMENT_TEAM` in `App/project.yml` before running on a device.
