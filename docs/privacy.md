# Privacy design and threat model

LittleThings.ai keeps relationship records and inference on the user's iPhone. There is no
product backend, account, cloud model, analytics or advertising SDK.

## Where data lives

| Data | Location | Protection |
|---|---|---|
| People, notes, facts, dates, promises, interactions, drafts, suggestion state, connections, automation rules, attachments | One SQLCipher database: `Application Support/Vault/vault.ltdb` | AES-256 (SQLCipher) with a random 256-bit key; `FileProtectionType.complete`; excluded from device backups |
| Vault key | Data-protection Keychain | `WhenPasscodeSetThisDeviceOnly` + `.userPresence`; never exported |
| Backup recovery key, share-inbox private key | Data-protection Keychain | `WhenUnlockedThisDeviceOnly`, not synchronized |
| Share-inbox items | App Group `ShareInbox/` | HPKE-sealed to the app's public key; opaque file names; deleted after import |
| Share-inbox public key | App Group | Not secret |
| Decrypted working set | App memory while unlocked | Dropped on lock |
| Pending notifications | iOS | Generic text by default; opaque identifiers |
| Exported backups | Wherever the user saves them | AES-256-GCM with the user-held recovery key |

## What leaves the device

Nothing, unless the user takes an explicit action:

- **Message handoff:** the system composer receives recipient and text the user reviewed.
- **Share/copy:** the user chooses the destination.
- **Merchant link:** the exact URL the user saved is opened in the browser.
- **Backup export:** the encrypted archive goes where the user chooses (warned that cloud drives
  are copies outside the device).

The core modules contain no networking code (enforced by `scripts/privacy-guards.sh`). Future
connectors (for example Gmail) will be device-side adapters with a per-adapter list of
destinations, fields sent, permissions and retention, recorded in the capability matrix.

## Threat model (PRD §10)

| Threat | Mitigation | Status |
|---|---|---|
| Lost, locked device | SQLCipher + Keychain key requiring passcode and user presence; file protection | Core tested; device behavior unverified |
| Shoulder surfing / app switcher | Opaque privacy shield whenever the app is inactive; relock after timeout | Implemented; unverified on device |
| Lock-screen disclosure | Generic notification text by default; sensitive items always generic; opaque IDs | Tested (planner) |
| Accidental exports | Recovery-key encryption; warning about cloud destinations | Tested (archive) |
| Malicious imported text / prompt injection | Validator grounds every item in the source; model and content have no authority; policy gate | Tested |
| Dependency telemetry | No analytics/crash SDKs; only SQLCipher (Apple) and swift-crypto (Linux tests) | Guarded in CI |
| Plaintext logs | No logging calls in product code; diagnostics show counts only | Guarded in CI |
| Compromised OS / unlocked device in someone else's hands | Out of scope; app lock reduces exposure only | Documented |

## Required before a real-user beta (PRD §10) — current status

| Requirement | Status |
|---|---|
| Encrypted vault and attachments, keys protected by device authentication | Implemented; Linux-tested; **device unverified** |
| Reauthentication on cold launch and after background timeout; obscured snapshots | Implemented; model-tested; **device unverified** |
| No private content in logs, filenames, notification IDs, analytics, clipboard | Implemented + guarded; notification IDs tested |
| Vault excluded from automatic backup; device-key migration behavior | Implemented; **not tested on device** |
| No remote crash reporting, analytics, model requests or contact sync | Implemented + guarded |
| Network inspection on a physical device | **Not done** |
| Denied and revoked permissions tested for every integration | Model-level tests for calendar/notifications; **device untested** |
| Encrypted exports tested for corruption, wrong secret, migration, interrupted writes | Tested (25 vault tests) |
| Per-person privacy controls, generic notifications, pause, permanent deletion | Implemented and tested |

Strict local-only privacy must not be claimed publicly until the device items above are done.

## Sources the user connects

Contacts and calendars may already sync through iCloud or Google. LittleThings' promise covers
its own copies and processing; it cannot change how those services store their data. This is
stated in Settings.
