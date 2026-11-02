# LittleThings.ai decision log

Architecture and privacy decision records. Each entry states the decision, why, what was
verified, and what remains open. Dates are when the decision was recorded.

| # | Decision | Status |
|---|---|---|
| D1 | Toolchain and verification strategy without Xcode | Accepted |
| D2 | Minimum iOS 18, Swift 6 language mode | Accepted |
| D3 | Package-first architecture: logic in `LittleThingsKit`, thin SwiftUI app | Accepted |
| D4 | SQLCipher (Zetetic SwiftPM package) with a minimal in-house C-API wrapper | Accepted |
| D5 | Hybrid schema: encoded bodies + key columns + enforced link tables | Accepted |
| D6 | Vault key: random 256-bit key in device-only, user-presence Keychain item | Accepted, device-unverified |
| D7 | Backup: app-generated 128-bit recovery key, HKDF-SHA256, AES-256-GCM | Accepted |
| D8 | Local intelligence: on-device Foundation Models only, always validated | Accepted, device-unverified |
| D9 | Deterministic pattern extractor as the no-AI path | Accepted |
| D10 | Share extension seals items with HPKE; no vault access | Accepted |
| D11 | Capture strategy: imports are imports; no monitoring claims | Accepted |
| D12 | Notifications: local only, generic by default, bounded window of 48 | Accepted |
| D13 | Suggestion engine is deterministic; per-person cap keeps first-shown card | Accepted |
| D14 | Unattended sending disabled until a channel is verified | Accepted |
| D15 | Bundle identifiers use a placeholder prefix | Accepted |
| D16 | CI on GitHub Actions (Linux + macOS) and static privacy guards | Accepted |

---

## D1 — Toolchain and verification strategy without Xcode (2026-11-02)

**Context.** The implementation session ran in an Ubuntu 24.04 container with no macOS,
Xcode, iOS SDK or simulator.

**Decision.**
- Install the Swift 6.4.2 Linux toolchain and the system `libsqlcipher-dev` (SQLCipher 4.5.6
  community) so the platform-independent core can be compiled and tested for real.
- Use `apple/swift-crypto` on Linux only; it exposes the CryptoKit API, so the same code uses
  CryptoKit on Apple platforms.
- Syntax-check every app file with `swiftc -parse` (no type checking).
- Add a GitHub Actions macOS job that runs the package tests against the real Apple
  dependencies and compiles the app for the simulator (D16).

**Consequence.** All logic is tested on Linux; the SwiftUI and Apple-framework adapter layer
is unverified until it is compiled with Xcode and exercised on a device. This is called out in
every place it matters ("UNVERIFIED" comments, the acceptance checklist, the handoff).

## D2 — Minimum iOS 18, Swift 6 (2026-11-02)

- **iOS 18.0** is the deployment target. Reasons: Contacts limited access
  (`CNAuthorizationStatus.limited`) and the `Tab` API; HPKE in CryptoKit (iOS 17+); Observation
  (iOS 17+).
- **Foundation Models** requires iOS 26 and is gated at runtime with `#available` and
  `SystemLanguageModel.default.availability`. The core app is fully usable on iOS 18 without AI.
- **SpeechAnalyzer** (iOS 26) is not used yet; the voice path uses `SFSpeechRecognizer` with
  `requiresOnDeviceRecognition = true`, offered only when `supportsOnDeviceRecognition` is true.
- **Swift 6** language mode with complete strict concurrency.
- Test matrix to run (not yet run): iOS 18 device without Apple Intelligence; iOS 26/27 device
  with Apple Intelligence on and off; a device with no passcode.

## D3 — Package-first architecture (2026-11-02)

Everything that does not need Apple UI frameworks lives in the `LittleThingsKit` Swift package
(`Package.swift` at the repo root): domain, vault, suggestions, integrations planning, local
intelligence contract, capture pipeline, action policy and the `@Observable` app model. The iOS
app (`App/`) contains SwiftUI views and thin adapters for Contacts, EventKit, UserNotifications,
LocalAuthentication, Keychain, MessageUI, Foundation Models, Speech and Vision.

This maps the PRD's suggested modules: Domain → `LTDomain`; Vault → `LTVault`;
SuggestionEngine → `LTSuggestions`; Integrations + IntegrationCapabilityRegistry →
`LTIntegrations` (+ app adapters); LocalIntelligence → `LTIntelligence` (+ app adapter);
CapturePipeline → `LTCapture`; ActionPolicy → `LTPolicy`; TestSupport → `LTTestSupport`;
AppShell/Features → `LTAppCore` + `App/LittleThings`.

## D4 — SQLCipher with a minimal wrapper (2026-11-02)

**Options considered.** GRDB + SQLCipher; SQLite.swift + SQLCipher; Zetetic's official
`SQLCipher.swift` SwiftPM package with a small wrapper; SwiftData (rejected: not encrypted).

**Decision.** Zetetic `SQLCipher.swift` **4.20.0** (pinned `exact`) on Apple platforms.
Verified on 2026-11-02 by cloning the repository: BSD-style "Community Edition Open Source
License", SwiftPM binary target (XCFramework) for iOS 12+/macOS 10.13+, last commit 2026-10-27.
A ~200-line wrapper (`Sources/LTVault/SQLite.swift`) binds statements; all cryptography is in
SQLCipher. Migrations are a small forward-only list keyed on `PRAGMA user_version`.

**Why not GRDB.** GRDB's SQLCipher integration on SwiftPM requires a custom setup, and the
wrapper surface needed here is tiny. Keeping the wrapper small also makes it testable on Linux
against the system SQLCipher.

**Encryption configuration.**
- Raw 256-bit key via `PRAGMA key = "x'…'"` (skips SQLCipher's passphrase KDF; key is random).
- `PRAGMA cipher_version` must return a value or opening fails (`encryptionUnavailable`): this
  prevents silently using plain SQLite.
- Wrong key → `SELECT count(*) FROM sqlite_master` fails → `cannotDecrypt`; nothing is shown.
- `secure_delete = ON`, `temp_store = MEMORY`, `journal_mode = DELETE` (single file at rest).
- Attachments are stored as BLOBs inside the encrypted database, not as separate files.

**Verified (Linux, SQLCipher 4.5.6):** the database file contains no plaintext marker, no
SQLite header, no schema text; wrong key fails closed and leaves the file byte-identical.
**Open:** run the same tests on macOS/iOS with the Zetetic binary (CI job), and confirm no
symbol conflict with the system `libsqlite3` in the app (Zetetic warns against linking both).

## D5 — Hybrid schema (2026-11-02)

Each record is stored as a JSON body plus key columns used for foreign keys, uniqueness and
dependency lookups (`person_id`, `source_id`, `fingerprint`, `idempotency_key` …). Many-to-many
person links use link tables with `ON DELETE CASCADE` from the owning record. Foreign keys use
NO ACTION semantics with `PRAGMA defer_foreign_keys = ON` per write transaction, so dependent
records can be written in any order but an orphan can never commit. Uniqueness constraints
enforce idempotency at storage level: `(provider, fingerprint)` for capture records and
`idempotency_key` for action attempts.

The whole decrypted working set is loaded into memory while unlocked (P0). Search scans an
in-memory corpus of pre-folded text derived from that snapshot; the corpus is rebuilt after every
change and never persisted, so there is no index that could retain deleted text.

Measured 2026-11-02 on the Linux build container (release build, not the reference iPhone) with
1,000 people and 20,000 notes: open + decrypt + load 0.33 s, one engine pass 11 ms, corpus build
0.17 s, search p95 129 ms (PRD targets: first screen < 2 s, search p95 < 300 ms after warm-up).
The first measurement found search p95 at 449 ms because every query re-folded all notes; the
corpus fixed it. Device measurement is still required.

## D6 — Vault key handling (2026-11-02)

- 256-bit key from CryptoKit `SymmetricKey` (system CSPRNG).
- Keychain generic password, data-protection keychain, `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`
  plus `SecAccessControl(.userPresence)`: requires a passcode, never in backups or device
  migration, deleted if the passcode is removed, and every read prompts for Face ID / Touch ID /
  passcode. Reading the key is the app lock (cold launch and after the background timeout).
- If the device has no passcode, real data is not stored; the app explains why and offers the
  demo (which uses a throwaway in-memory key and a temporary directory).
- The vault directory is excluded from device backups and gets `FileProtectionType.complete`.

**Unverified on device:** exact Keychain error codes when no passcode is set, behaviour across
device migration and iCloud backup restore, and whether `.complete` file protection interferes
with any background work (none is scheduled today).

## D7 — Backup format (2026-11-02)

- The app generates a **128-bit recovery key**, displayed as 28 Crockford base32 characters
  (26 + a 10-bit checksum) in groups of four. Because it is uniformly random rather than a
  human-chosen password, HKDF-SHA256 is an appropriate KDF; no slow password KDF is needed.
- Archive: `"LTBACKUP"` ‖ u16 format version ‖ u32 header length ‖ header JSON ‖ AES-256-GCM
  combined box. The header (format/schema version, created date, app version, KDF, salt,
  non-secret key ID) is authenticated as associated data and contains no relationship content.
- The device-bound vault key is never exported. Restore decrypts and validates everything in
  memory (format, integrity, schema version, referential integrity), builds a complete staged
  database, verifies it, then swaps it in with an atomic `rename`. Any failure before the swap
  leaves the live vault open and untouched. Merge restore is out of scope.
- The recovery key is stored in a device-only Keychain item only after the user confirms they
  wrote it down (so later exports don't require re-entry).

## D8 — Local intelligence (2026-11-02)

- Only `SystemLanguageModel.default` (on-device). The iOS 27 SDK adds a Private Cloud Compute
  model (per the capability research); it is a server model and is **never** used. A CI guard
  fails the build if a PCC or remote-model symbol appears.
- Model output is decoded into `RawExtraction` and passed through `ExtractionValidator`:
  excerpts must appear in the source, values must be supported by their excerpt, dates are
  re-derived from text (model numbers are ignored), commitments need a commitment cue, reposts /
  old news / aspirations are not current events, identity must resolve or the user chooses.
- The model has no tools and cannot act. Only the selected source and its linked people are sent
  to it. Input is bounded (~6,000 characters) because the on-device context is 4,096 tokens.
- **Unverified:** compile against the iOS 26+ SDK; extraction quality; `supportsLocale` behavior.

## D9 — Pattern extractor (2026-11-02)

Without AI, a deterministic extractor recognizes common phrasings (relationships, dated events,
"I promised to…", "ask … how…", new jobs and moves) and emits the same `RawExtraction`, so it
goes through the same validator. The UI labels these "Suggestions from your wording". This gives
useful, honest assistance on devices without Apple Intelligence.

## D10 — Share inbox with HPKE (2026-11-02)

The share extension never opens the vault (memory limits, concurrency, and least privilege). The
main app generates an X25519 key pair; the private key stays in its device-only Keychain and the
public key is written to the App Group. The extension seals each shared item with HPKE
(X25519/HKDF-SHA256/ChaCha20-Poly1305) and writes an opaque file name. The app opens items on
activation, saves them as sources, deletes the inbox file, and asks the user to review.

## D11 — Capture strategy (2026-11-02)

Research (docs/integrations/capability-matrix.md, 44 routes, checked 2026-11-02) found no
supported automatic read route for iMessage/SMS, WhatsApp, Messenger, Instagram DMs or LinkedIn
messages for a typical iPhone user. Implemented now, in preference order:

1. Contacts via the system picker (no permission needed) and EventKit (selected calendars).
2. Share extension for text, links and files.
3. User-initiated imports with preview: WhatsApp per-chat export (`.txt`) → observed
   interactions per active day + transcript; LinkedIn `Connections.csv` → stores only matched
   rows and flags role changes as undated, unconfirmed life updates.
4. Manual entry.

Imports are labelled as one-off imports everywhere ("nothing is monitored"). The next automatic
routes to prototype are Gmail metadata (on-device OAuth + PKCE; restricted-scope verification
required) and Microsoft Graph `Mail.ReadBasic` — see the matrix's prioritized experiments.

## D12 — Notifications (2026-11-02)

Local notifications only. Lock-screen text is "You have a relationship reminder." unless the
user opts into details; sensitive items stay generic regardless. Identifiers are opaque
`lt.` + SHA-256 prefixes. Date-only reminders use floating `DateComponents` (follow the user's
time zone); timed events and snoozes are absolute. The planner keeps at most **48** pending
(iOS's limit is commonly 64; the matrix records it as confirmed only by an Apple engineer forum
post) and the app reconciles on activation and after every edit. At most one digest per day by
default for suggestions without an explicit reminder.

## D13 — Suggestion engine behavior (2026-11-02)

Deterministic rules with tiers in the PRD's priority order (pinned → commitment → date → meeting
→ context → cadence) and a stable tie-breaker; no person or relationship score. The per-person
daily cap counts cards already shown today, so a card the user has seen keeps its slot and later
cards for the same person wait in "More" — cards don't reshuffle under the user. Life-update cards
require a confirmed, explicit, dated event within 7 days; undated or old updates never alert.
Rhythm (FR14) follows the PRD's initial rule with configurable parameters and requires
continuous, fresh coverage from the specific connected source.

## D14 — Unattended sending disabled (2026-11-02)

`ChannelCapabilities.unattendedSend` is empty in this build. MessageUI cannot send unattended;
TelephonyMessagingKit is EU-only and requires becoming the default messaging app; the Shortcuts
personal-automation route is unverified. The action policy, rule approvals and idempotency are
implemented and tested so that a verified channel can be enabled later; until then every rule
falls back to review.

## D15 — Placeholder bundle prefix (2026-11-02)

The littlethings.ai domain is not verified as owned and a similarly named app exists. Bundle and
App Group identifiers derive from `LT_BUNDLE_PREFIX` (default `com.example.littlethings`) in
`App/project.yml`. No domain is used in authentication, email or service URLs.

## D16 — CI and static privacy guards (2026-11-02)

`.github/workflows/ci.yml` runs (1) `scripts/privacy-guards.sh`, (2) the package tests on Linux
with system SQLCipher, and (3) on macOS the package tests against CryptoKit and the Zetetic
binary, an XcodeGen project generation, a simulator build of the app and share extension, and the
7 UI tests on an iPhone simulator (all passing since run 6; still marked non-blocking until they
have stayed green for several runs). Docs-only pushes skip CI. The repository is public,
so these runs do not consume paid minutes. The guards fail on remote-model symbols, analytics or
crash SDKs, networking APIs in core modules, logging calls, weak or synchronized Keychain classes,
and card/CVV fields.
