# LittleThings.ai

*Remember the little things. Show up for the big ones.*

LittleThings.ai is a private, iPhone-first relationship assistant. It helps you remember what
matters about the people in your life, notices the moments that count, and helps you follow
through — without a server, an account, a cloud AI or analytics. Relationship records and
inference stay on your iPhone.

> Naming note: the littlethings.ai domain is not verified as owned and a similarly named app
> exists. Naming clearance is a launch dependency. Identifiers use a placeholder prefix.

The product requirements are in [`docs/PRD.md`](docs/PRD.md) (the implementation authority).

## Status

| Area | State |
|---|---|
| Core package (`LittleThingsKit`) | Implemented; **168 tests passing** on Linux (Swift 6.4.2, SQLCipher 4.5.6) and in CI on Linux and macOS |
| iPhone app (SwiftUI) and share extension | Implemented; compiled in CI with Xcode on the iOS Simulator SDK; **not yet run on a device** |
| UI tests | Written; run in CI on a simulator (non-blocking until stabilized) |
| Device verification (Face ID, Keychain, notifications, Contacts, Calendar, Messages, on-device AI, network inspection) | **Not done** — see [`docs/handoff.md`](docs/handoff.md) |

See [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) for every requirement marked
passed, failed or not tested, with evidence.

## What it does today

- **Today**: up to three calm, explained cards (birthdays and dates, promises and follow-ups,
  scheduled meetings with briefs, confirmed life updates, trips that overlap someone's city,
  check-ins you asked for, and observed conversation lulls from sources you connected). Every
  card has "Why this appeared" with dated evidence. Snooze, dismiss, done.
- **Memories**: type, dictate (only when on-device transcription is guaranteed) or read text from
  a photo. Details are proposed from your wording — or by Apple's on-device model when
  available — and saved only after you review them, each linked to the exact words it came from.
- **People**: selective import with the system contact picker (no Contacts permission needed),
  duplicates by phone/email with reviewed, undoable merges, circles, favorites, archive, pause,
  per-person boundaries, timeline, dates, promises, gifts.
- **Drafts**: deterministic templates in four tones; you choose any context to include; Messages
  or Mail opens with recipient and text for you to send. LittleThings never sends, buys or shares
  on its own.
- **Capture**: share extension for text, links and files; one-off imports of a WhatsApp chat
  export or LinkedIn `Connections.csv` with a preview before saving. These are imports, not
  monitoring.
- **Privacy**: encrypted SQLCipher vault, key in a device-only Keychain item that requires Face ID /
  Touch ID / passcode, privacy shield in the app switcher, relock on timeout, generic lock-screen
  reminders by default, encrypted backups with a recovery key only you hold, delete one person or
  everything.

What isn't possible yet, and why, is documented route by route in the
[capability matrix](docs/integrations/capability-matrix.md) (44 routes; for example, no
supported API lets an iPhone app read iMessage, SMS or WhatsApp history automatically).

## Repository layout

```
Package.swift              LittleThingsKit (platform-independent core)
Sources/LT*/               Domain, Vault, Suggestions, Integrations, Intelligence, Capture, Policy, AppCore, TestSupport
Tests/LT*Tests/            Swift Testing suites with synthetic fixtures
App/project.yml            XcodeGen spec for the iPhone app, share extension and UI tests
App/LittleThings/          SwiftUI app and Apple framework adapters
App/ShareExtension/        Share extension (HPKE-sealed inbox)
App/LittleThingsUITests/   UI tests
docs/                      PRD, architecture, decision log, privacy, action policy, capability matrix, checklist, handoff
scripts/privacy-guards.sh  Static checks for forbidden APIs/SDKs
```

## Supported environments

- **App**: iOS 18.0 or later (iPhone). On-device AI requires iOS 26+ on an Apple
  Intelligence–eligible device with Apple Intelligence on; everything else works without it.
  Built in CI with Xcode 26.6 (iOS 26.5 SDK).
- **Core package**: macOS 15+ (Xcode 16+) or Linux with Swift 6.x and `libsqlcipher-dev`.

## Build and test

### Core package

macOS (uses CryptoKit and Zetetic's SQLCipher package):

```sh
swift test
```

Linux (uses system SQLCipher and swift-crypto):

```sh
sudo apt-get install libsqlcipher-dev
swift test
```

### iPhone app

```sh
brew install xcodegen
cd App
xcodegen generate
open LittleThings.xcodeproj
```

Before running on a device, set `LT_BUNDLE_PREFIX` and `DEVELOPMENT_TEAM` in `App/project.yml`
(the App Group identifier is derived from the prefix), then regenerate. A device passcode is
required to create a real vault; without one, the app offers the synthetic demo.

Command-line simulator build (what CI runs):

```sh
cd App && xcodegen generate
xcodebuild -project LittleThings.xcodeproj -scheme LittleThings \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

### Privacy guards

```sh
./scripts/privacy-guards.sh
```

## Local data behavior

- All relationship data lives in one encrypted file in the app's Application Support directory,
  excluded from device backups. The key never leaves the device.
- Deleting a person, a note or everything removes LittleThings' copies (including derived
  details, suggestion state and pending reminders). It cannot erase backups you exported,
  messages you sent, or data in the source services (iCloud, Google, WhatsApp, LinkedIn).
- If you lose your iPhone without an encrypted backup and its recovery key, your records cannot
  be recovered.

## Documentation

- [Architecture](docs/architecture.md) · [Decision log](docs/decision-log.md) ·
  [Privacy design](docs/privacy.md) · [Action policy](docs/action-policy.md)
- [Capability matrix](docs/integrations/capability-matrix.md) ·
  [Acceptance checklist](docs/acceptance-checklist.md) · [Handoff](docs/handoff.md)
