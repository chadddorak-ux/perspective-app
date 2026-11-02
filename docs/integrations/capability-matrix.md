# LittleThings.ai — Integration Capability Matrix

**Verification date:** 2026-11-02  
**Scope:** integration feasibility research only. No route has been tested against a real account or device yet, so every row has `tested_in_app: false`.  
**Machine-readable twin:** [`capability-matrix.json`](capability-matrix.json), which has the same rows and keys and feeds the in-app catalog.

## Status legend

| Status | Meaning in this matrix |
| --- | --- |
| `verified` | Primary docs confirm that a supported route exists and fits our constraints (on-device, no backend, user-authorized). It has **not** been tested in our app. |
| `prototype` | A plausible supported route that still needs a hands-on test or a provider approval. |
| `blocked` | A route exists but is blocked by terms, approval, region, or a backend requirement. |
| `unavailable` | No supported route exists for this data. |
| `not investigated` | Not researched in this pass. |

Other columns: **On-device** means all processing can stay on the device (`partial` means part of the flow can't). **Backend?** means the route would force a server we operate.

## Method and evidence rules

- Every URL in a `docs` field was fetched in this session, or seen as a search-result snippet where the row says so. URLs that failed to load are listed under [Could not verify](#could-not-verify) and are never used as evidence.
- Apple developer documentation pages render with JavaScript. They were retrieved through the equivalent `https://developer.apple.com/tutorials/data/documentation/<path>.json` endpoint, and the `docs` arrays give the matching human-readable `developer.apple.com/documentation/<path>` URL.
- Developer Forums replies from Apple staff are treated as strong but non-normative evidence. Third-party sources (one MacMost article) are labelled as such.

## Key findings

1. **Automatic, on-device conversation rhythm is realistic only from email, calendar and contacts.** Gmail API (Restricted scopes; Google verification needed for launch; per Google's doc the CASA security assessment applies only when data is stored on or sent through servers, which needs confirming during verification) and Microsoft Graph (Mail.ReadBasic, personal and work accounts) both allow on-device public-client OAuth.
2. **No messaging channel (iMessage, SMS, WhatsApp, Messenger, Instagram DM, LinkedIn messages) has a supported automatic on-device read route for a US/global iPhone user.** For messaging, LittleThings is limited to manual exports and user-shared content.
3. **The one route that exposes LinkedIn connections and inbox is the EU DMA Member Data Portability API.** It is EEA-only, needs business verification, and its documented token exchange requires `client_secret`, so it would need a backend. Meta's DMA route pushes data into servers the destination hosts.
4. **Unattended send:** MessageUI can never send without the user tapping Send, and its `sent` result means 'queued or sent', not delivered. The only possible unattended routes are (a) TelephonyMessagingKit, which is EU-only and requires LittleThings to replace the user's SMS app, and (b) a Shortcuts personal automation the user builds and sets to not ask. Whether (b) runs Send Message without a prompt on iOS 26 is unverified.
5. **Foundation Models:** 4,096-token context, gated by device, region and Apple Intelligence settings. Docs for iOS 27 describe an opt-in `PrivateCloudComputeLanguageModel` (server-based), which this product must not use.
6. **Pending local notifications are capped at 64 per app** (an Apple engineer on the forums; not in reference docs). Background tasks are best-effort only.

## Summary table

| Channel | Route | Status | On-device | Backend? | Next experiment |
| --- | --- | --- | --- | --- | --- |
| contacts | iOS Contacts framework (CNContactStore) read, with full or user-limited authorization (`contacts-cncontactstore`) | `verified` | yes | no | Spike: call requestAccess, handle .limited by showing ContactAccessButton, and read the selected contacts' birthdays and anniversaries into the on-device store. Confirm what the app sees after the person adds more contacts in Settings. |
| calendar | EventKit EKEventStore with requestFullAccessToEvents (iOS 17+) (`calendar-eventkit-full-access`) | `verified` | yes | no | Spike: request full access, query the last 12 months of events, match attendees to contacts by email or phone, and compute each person's meeting cadence on-device. Time the query on a calendar with about 5k events. |
| calendar | EventKit write-only access (requestWriteOnlyAccessToEvents), or the EventKitUI editor with no permission at all (`calendar-eventkit-write-only`) | `verified` | yes | no | Use EKEventEditViewController for flows like 'add birthday reminder' or 'schedule coffee', and confirm on iOS 26 that no permission prompt appears. |
| linkedin | LinkedIn self-serve OAuth permissions: Sign In with LinkedIn using OpenID Connect (profile, email) and Share on LinkedIn (w_member_social) (`linkedin-open-permissions`) | `unavailable` | partial | yes | None for capture. Only if a 'share to LinkedIn' feature is wanted: ask LinkedIn developer support whether a public client (PKCE, no client_secret) is allowed. |
| linkedin | LinkedIn Connections API (r_1st_connections) or Compliance APIs (r_compliance) (`linkedin-connections-partner-api`) | `blocked` | partial | yes | None. Do not pursue unless a LinkedIn partnership becomes a business goal. |
| linkedin | LinkedIn Member Data Portability (3rd Party) API under the EU DMA: Member Snapshot API and Member Changelog API (`linkedin-dma-portability-api`) | `blocked` | partial | yes | Product decision: an EEA-only feature would need (a) LinkedIn business verification and (b) a token-exchange service holding client_secret, which is a backend and conflicts with current constraints. Meanwhile, ask LinkedIn whether a public client (PKCE) is allowed for r_dma_portability_3rd_party. |
| linkedin | User-requested LinkedIn data archive ('Get a copy of your data'), imported through Files or the share sheet (`linkedin-data-archive-import`) | `prototype` | yes | no | Request a real archive from a test account and record the exact file names and columns. Write an on-device parser, then compare two exports taken about a month apart to detect job or company changes. |
| facebook | Facebook Login with the Graph API user_friends permission (`facebook-graph-user-friends`) | `unavailable` | partial | unknown | None. It cannot return the user's social graph or friends' life updates. |
| facebook | Graph API user_posts (the user's own timeline posts) (`facebook-graph-user-posts`) | `blocked` | partial | unknown | None. The use case does not match the allowed usage. |
| facebook | Meta Accounts Center 'Export your information' (Download Your Information) to the device in JSON, then imported into the app (`facebook-dyi-export`) | `prototype` | yes | no | Export JSON from a test account with Messages and Friends selected. Document the folder layout and the message JSON fields (sender, timestamp, content, text encoding are all not verified), then build an on-device parser. |
| facebook | Meta Data Portability (DMA): become a destination in Export Your Information using the Data Transfer Project (`meta-data-portability-dtp`) | `blocked` | no | yes | None under current constraints. Record it as a hard backend dependency, and check again if Meta publishes a pull-style DMA API. |
| instagram | Instagram API (Instagram Login, Facebook Login or Unified Login), including messaging and webhooks (`instagram-api-professional`) | `unavailable` | no | unknown | None. There is no consumer or personal-account API. |
| instagram | Instagram 'Export your information' through Meta Accounts Center, imported into the app (`instagram-data-export`) | `prototype` | yes | no | Export JSON from a test Instagram account (messages, followers, following), document the schema, and reuse the Meta DYI parser. |
| email | Gmail API called directly from the iOS app, with Google OAuth for installed apps (PKCE, no client secret) (`email-gmail-api`) | `prototype` | yes | no | Create an iOS OAuth client in a test Google Cloud project (testing mode) and sign in with AppAuth or Google Sign-In using gmail.metadata. Fetch 90 days of headers on-device and compute per-contact cadence. Then file for restricted-scope verification and confirm that no CASA is needed because there is no server. |
| email | Microsoft Graph /me/messages with delegated permissions from a public client (MSAL) on the device (`email-microsoft-graph`) | `prototype` | yes | no | Register a multi-tenant public-client app that also allows personal accounts. Sign in with MSAL on iOS, list 90 days with $select=from,toRecipients,sentDateTime,subject, and check the consent screens for an outlook.com account and a default Microsoft 365 tenant. |
| email | Generic IMAP with SASL XOAUTH2 (Outlook.com and Microsoft 365; Gmail through the https://mail.google.com/ scope) (`email-imap-oauth`) | `prototype` | yes | no | Only if the Graph or Gmail REST APIs fall short: test XOAUTH2 against outlook.office365.com and imap.gmail.com with an on-device IMAP library, and compare battery and latency with the REST APIs. |
| email | Mac companion Mail extension (MailKit message action handler) observing messages as Apple Mail downloads them (`email-mailkit-mac`) | `prototype` | partial | no | Build a MailKit extension on macOS 26 that logs MEMessage headers for incoming mail. Check whether rawData is populated and whether the handler sees messages from every account. |
| email | Reading Apple Mail on iPhone (`email-apple-mail-ios`) | `unavailable` | no | no | None. Use Gmail, Graph or IMAP OAuth for the underlying account instead. |
| imessage-sms | A third-party iOS app reading Messages (iMessage or SMS) history (`imessage-sms-ios-history-read`) | `unavailable` | no | no | File an enhancement request through Feedback Assistant, as DTS suggests, describing a consented, on-device, per-contact metadata read. Nothing to build. |
| imessage-sms | TelephonyMessagingKit: LittleThings becomes the user's default carrier messaging app (SMS, MMS, RCS) (`imessage-sms-telephonymessagingkit`) | `blocked` | yes | no | Product decision only. An EU-only full SMS client is outside the product's scope; revisit if Apple expands the regions. If it is ever pursued, develop with the Apple-provided provisioning profile, which works in all regions for testing. |
| imessage-sms | Default (internet) messaging app entitlement, com.apple.developer.messaging-app (iOS 18.2+) (`imessage-sms-default-messaging-app`) | `unavailable` | no | no | None. |
| imessage-sms | SMS/MMS message filter extension (IdentityLookup, ILMessageFilterExtension) (`imessage-sms-filter-extension`) | `unavailable` | no | no | None. It sees no messages from known contacts and cannot pass data to the app. |
| imessage-sms | Mac companion reading the Messages database (~/Library/Messages) with user-granted Full Disk Access (`imessage-sms-mac-chatdb-fda`) | `blocked` | yes | no | Do not build. Treat it as a product and legal decision: it reads another app's undocumented private store and can't ship on the Mac App Store. If it is ever reconsidered, get legal review first. |
| imessage-sms | Mac companion scripting the Messages app with AppleScript (Apple Events) (`imessage-sms-mac-applescript`) | `unavailable` | partial | no | Optional one-hour check: open the Messages scripting dictionary on macOS 26 and confirm whether message content or timestamps are exposed. |
| imessage-sms | The user shares a screenshot or selected text of a conversation into LittleThings (share extension), with on-device Vision OCR (`imessage-sms-user-share-capture`) | `prototype` | yes | no | Build a share-extension spike that accepts images and text, run RecognizeTextRequest on a Messages screenshot in airplane mode, and measure how accurately sender and timestamp segments come out. |
| whatsapp | WhatsApp per-chat 'Export chat' on iPhone, shared into LittleThings through the share sheet (`whatsapp-chat-export`) | `prototype` | yes | no | Export a one-to-one and a group chat, with and without media, from WhatsApp on iOS. Confirm a LittleThings share extension appears and what it receives (ZIP or .txt), document the line format and date-locale variants, and build the parser. |
| whatsapp | WhatsApp Business Platform (Cloud API) (`whatsapp-business-platform`) | `blocked` | no | yes | None. It is the wrong product (business messaging) and needs a server. |
| whatsapp | Reading WhatsApp Mac or desktop app data from a Mac companion (`whatsapp-mac-desktop`) | `unavailable` | no | no | None. For capture on the Mac, use user-initiated screen capture or the share/Services route instead. |
| desktop-capture | Mac companion: user-initiated capture through the system picker (SCContentSharingPicker, ScreenCaptureKit), then on-device Vision OCR (`desktop-screencapturekit-ocr`) | `prototype` | yes | no | Spike on macOS 26: present SCContentSharingPicker, grab one frame of a Messages or WhatsApp window with SCScreenshotManager, and OCR it with RecognizeTextRequest offline. Record which permission prompts appear and whether a sandboxed build works. |
| desktop-capture | Mac companion reading other apps' on-screen text through the Accessibility (AX) API (`desktop-accessibility-api`) | `blocked` | yes | no | None. Use the picker-based capture or the share/Services route. |
| desktop-capture | Mac companion share extension or Services-menu item: the user selects text in any app and sends it to LittleThings (`desktop-share-services`) | `prototype` | yes | no | Build a macOS share extension plus an NSServices entry that accept text, and verify they appear for selections in Messages, WhatsApp and Safari on macOS 26. |
| desktop-capture | User-initiated Safari Web Extension that captures the current page when the user clicks (`desktop-browser-extension`) | `not investigated` | partial | no | Separate feasibility study: Safari Web Extension permission model (per-site grant on click), and LinkedIn's and Meta's terms on user-initiated page capture. |
| platform | Apple Foundation Models on-device LLM (SystemLanguageModel) (`platform-foundation-models`) | `verified` | yes | no | Run an availability and supportsLocale matrix on test devices (eligible, ineligible, Apple Intelligence off). Benchmark guided-generation 'life update' extraction on chunks of about 3.5k tokens, and design a rule-based fallback for ineligible devices. |
| platform | On-device speech-to-text with SpeechAnalyzer and SpeechTranscriber (iOS 26+) (`platform-speechanalyzer`) | `prototype` | partial | no | In airplane mode on iOS 26, install en-US assets through AssetInventory, transcribe a 2-minute voice note, and confirm it works without network. Repeat on an older device with DictationTranscriber. |
| platform | SFSpeechRecognizer with requiresOnDeviceRecognition = true, gated on supportsOnDeviceRecognition (`platform-sfspeechrecognizer-ondevice`) | `verified` | yes | no | Implement a hard gate: if supportsOnDeviceRecognition is false for the locale, disable voice capture. Test with en-US and one less common locale. |
| platform | Vision text recognition (RecognizeTextRequest; iOS 18+, macOS 15+) (`platform-vision-ocr`) | `prototype` | partial | no | Run OCR on 20 chat screenshots in airplane mode, record accuracy and latency, and log supportedRecognitionLanguages on iOS 26. |
| platform | iOS and macOS Share extension receiving text, URLs, images and files from other apps (`platform-share-extension`) | `verified` | yes | no | Build a share extension that writes into an App Group container and test receiving WhatsApp export ZIPs, LinkedIn CSVs and screenshots. |
| platform | MessageUI MFMessageComposeViewController (prefilled iMessage/SMS that the user sends) (`platform-messageui-composer`) | `verified` | yes | no | Use it for the 'reach out' action. Log only the sent, cancelled or failed result locally, and never treat sent as delivered. |
| platform | User-configured Shortcuts personal automation (for example Time of Day or Message trigger, then Send Message), with LittleThings supplying text through an App Intent (`platform-shortcuts-automation-send`) | `prototype` | yes | no | On an iOS 26 device, build a Time of Day automation (Ask Before Running off) that runs a test App Intent returning text into Send Message to a second test phone. Record any confirmation UI, the lock-screen behavior, and the result. |
| platform | Contacts limited access: ContactAccessButton and contactAccessPicker (iOS 18+) (`platform-contacts-limited-access`) | `verified` | yes | no | Make limited access the default onboarding path, with ContactAccessButton bound to the 'add person' search field. Measure how many contacts users grant. |
| platform | UNUserNotificationCenter local notifications: limit on pending requests (`platform-local-notification-limit`) | `verified` | yes | no | Schedule only the nearest ~60 reminders and refill on launch and during BGAppRefresh. Add a test that schedules 70 and records which ones survive on iOS 26. |
| platform | BGTaskScheduler background refresh and processing (`platform-bgtaskscheduler`) | `verified` | yes | no | Instrument BGAppRefreshTask and BGProcessingTask launch times on 3 test phones for 2 weeks, so the product never promises timely automatic capture. |
| platform | Gift purchase by handing off to the merchant's own checkout (open the merchant URL in Safari or SFSafariViewController) (`platform-apple-pay-merchant-handoff`) | `prototype` | yes | no | Open three common gift merchants' product pages in SFSafariViewController and confirm their Apple Pay web checkout is offered and completes. |
| platform | In-app Apple Pay, with LittleThings as the merchant (`platform-apple-pay-in-app`) | `blocked` | no | yes | None unless LittleThings becomes a merchant. Record the PSP and merchant processing as a backend dependency. |

## Per-channel detail

### Contacts (iOS)

_Fully on-device and supported. Limited access on iOS 18+ (see `platform-contacts-limited-access`) should be the default request._

#### `contacts-cncontactstore` — iOS Contacts framework (CNContactStore) read, with full or user-limited authorization

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Contacts authorization via CNContactStore requestAccess(for:). On iOS 18+ the person chooses full access or a chosen subset (CNAuthorizationStatus.limited) and can change it later in Settings.
- **Data scope:** Address-book records the app is allowed to see: names, phone numbers, emails, dates such as birthdays, and so on (exact field list not re-verified this session). With limited access, only the contacts the person picked.
- **Historical coverage:** The address book's current state only. There is no interaction or communication history.
- **Refresh cadence:** On demand while the app runs. Change-tracking APIs were not verified this session.
- **Restrictions:** App Review 5.1.1(iii): use the out-of-process picker where possible instead of full access. 5.1.2(iv): Contacts data must not be used to build a contact database for the app's own use or for sale. 5.1.2(v): the app may contact people only at the user's explicit, individual initiative.
- **Evidence:** The ContactAccessButton docs say people 'can choose to give the app full access to their contacts or to a subset of contacts' on the first requestAccess and can update that in Settings. App Review 5.1.1(iii) recommends the out-of-process picker over full access to Contacts.
- **Next experiment:** Spike: call requestAccess, handle .limited by showing ContactAccessButton, and read the selected contacts' birthdays and anniversaries into the on-device store. Confirm what the app sees after the person adds more contacts in Settings.
- **Docs:**
  - <https://developer.apple.com/documentation/contactsui/contactaccessbutton>
  - <https://developer.apple.com/app-store/review/guidelines/>

### Calendar (iOS EventKit)

_Fully on-device and supported. Reading events needs full access; there is no read-only tier. For adding events, EventKitUI needs no permission at all._

#### `calendar-eventkit-full-access` — EventKit EKEventStore with requestFullAccessToEvents (iOS 17+)

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Full calendar access, with the NSCalendarsFullAccessUsageDescription key in Info.plist. On iOS 17+, a missing key, or only the legacy NSCalendarsUsageDescription, makes iOS deny the request automatically.
- **Data scope:** Create, view, edit and delete events across the device's calendars. Attendee fields are expected but were not re-verified this session.
- **Historical coverage:** Whatever the calendars synced to the device contain. Limits on query ranges were not verified.
- **Refresh cadence:** On demand while the app runs, plus best-effort background refresh. Store-change notifications were not verified this session.
- **Restrictions:** There is no read-only option: 'To read events or reminders from the event store, your app needs full access.' Sandboxed macOS apps need the com.apple.security.personal-information.calendars entitlement.
- **Evidence:** Apple says full access 'lets your app create, view, edit, and delete data', and that reading events needs full access. iOS 17+ needs the new usage-description keys or 'iOS automatically denies any access request'.
- **Next experiment:** Spike: request full access, query the last 12 months of events, match attendees to contacts by email or phone, and compute each person's meeting cadence on-device. Time the query on a calendar with about 5k events.
- **Docs:**
  - <https://developer.apple.com/documentation/eventkit/accessing-the-event-store>

#### `calendar-eventkit-write-only` — EventKit write-only access (requestWriteOnlyAccessToEvents), or the EventKitUI editor with no permission at all

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** NSCalendarsWriteOnlyAccessUsageDescription for write-only access. EventKitUI (EKEventEditViewController) needs no calendar permission on iOS 17+.
- **Data scope:** Create events only. Write-only access 'doesn't let it read any events or other calendar information, including events your app created'. A calendar listing returns one virtual calendar.
- **Historical coverage:** None (no reading).
- **Refresh cadence:** Not applicable.
- **Restrictions:** None found. Apple advises requesting only the access a feature needs.
- **Evidence:** EventKitUI 'presents chooser and editor UI outside of your app's process on iOS 17 and later', and an app 'can use EventKitUI without requesting write-only or full calendar access.'
- **Next experiment:** Use EKEventEditViewController for flows like 'add birthday reminder' or 'schedule coffee', and confirm on iOS 26 that no permission prompt appears.
- **Docs:**
  - <https://developer.apple.com/documentation/eventkit/accessing-the-event-store>

### LinkedIn

_No open API exposes connections, feed or messages. The EU DMA portability API does expose CONNECTIONS and INBOX, but only to EEA members, behind business verification, and with a client_secret token exchange, which implies a backend. The realistic route is a manual archive import._

#### `linkedin-open-permissions` — LinkedIn self-serve OAuth permissions: Sign In with LinkedIn using OpenID Connect (profile, email) and Share on LinkedIn (w_member_social)

- **Status:** `unavailable` · **On-device feasible:** partial · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** profile, email and w_member_social, added self-serve on the Developer Portal Products tab.
- **Data scope:** The signed-in member's own name, headline, photo and primary email, plus posting, commenting and liking as that member. No connections, feed or messages.
- **Historical coverage:** None for relationship data.
- **Refresh cadence:** Not applicable.
- **Restrictions:** These are the only permissions open to every developer; 'Most permissions and partner programs require explicit approval'. In the documented 3-legged flow the token exchange needs client_secret, and LinkedIn says to keep it secure. PKCE for native apps is not documented on the pages fetched.
- **Evidence:** Getting Access lists the open consumer permissions as profile and email (OIDC) plus w_member_social, and says other programs are gated. The Authorization Code Flow page lists client_secret as Required in the access-token request.
- **Next experiment:** None for capture. Only if a 'share to LinkedIn' feature is wanted: ask LinkedIn developer support whether a public client (PKCE, no client_secret) is allowed.
- **Docs:**
  - <https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access>
  - <https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow>

#### `linkedin-connections-partner-api` — LinkedIn Connections API (r_1st_connections) or Compliance APIs (r_compliance)

- **Status:** `blocked` · **On-device feasible:** partial · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** r_1st_connections (not among the open permissions) or r_compliance (the Compliance program is 'closed and may not be requested').
- **Data scope:** List of 1st-degree connections (from a search-result snippet of the Connections API doc; the page itself was not opened).
- **Historical coverage:** Unknown.
- **Refresh cadence:** Unknown.
- **Restrictions:** Needs partner approval. Compliance is closed. The snippet notes connection data is subject to members' privacy settings.
- **Evidence:** Getting Access shows that Compliance permissions (r_compliance) are 'closed and may not be requested', and that r_1st_connections is not an open permission. The Connections API snippet says it needs r_1st_connections or r_compliance.
- **Next experiment:** None. Do not pursue unless a LinkedIn partnership becomes a business goal.
- **Docs:**
  - <https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access>
  - <https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/connections-api>

#### `linkedin-dma-portability-api` — LinkedIn Member Data Portability (3rd Party) API under the EU DMA: Member Snapshot API and Member Changelog API

- **Status:** `blocked` · **On-device feasible:** partial · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** r_dma_portability_3rd_party through 3-legged OAuth. The developer app needs a LinkedIn Company Page with a verified association, business verification (business email, legal name, registered address, website, privacy policy) and LinkedIn review of the access request.
- **Data scope:** Snapshot domains include CONNECTIONS ('Name, position, company, and connection date of 1st degree connections'), INBOX ('Messages sent and received in the member's inbox'), PROFILE, POSITIONS, INVITATIONS, MEMBER_SHARE_INFO, PREMIUM_NOTES and more. The Changelog covers the member's own interactions (posts, comments, reactions).
- **Historical coverage:** Snapshot: historical data processed after consent; 'Data for certain domains will be available sooner than others'. Changelog: only events after consent, and only the past 28 days can be queried.
- **Refresh cadence:** Snapshot on demand. The Changelog must be polled at least every 28 days to avoid gaps.
- **Restrictions:** Only LinkedIn members in the EEA can consent (3rd-party doc). The help center says EU/EEA or Switzerland, based on profile location. Personal email addresses fail business verification. The token exchange needs client_secret. The API needs the header Linkedin-Version: 202312.
- **Evidence:** The only DMA route found that exposes connections and inbox messages. LinkedIn says 'Only LinkedIn users from the European Economic Area are allowed to consent', and access requires a verified Company Page plus business verification. Because CONNECTIONS includes each connection's current position and company, comparing snapshots would surface job changes.
- **Next experiment:** Product decision: an EEA-only feature would need (a) LinkedIn business verification and (b) a token-exchange service holding client_secret, which is a backend and conflicts with current constraints. Meanwhile, ask LinkedIn whether a public client (PKCE) is allowed for r_dma_portability_3rd_party.
- **Docs:**
  - <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/>
  - <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api>
  - <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain>
  - <https://www.linkedin.com/help/linkedin/answer/a6214075>
  - <https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow>

#### `linkedin-data-archive-import` — User-requested LinkedIn data archive ('Get a copy of your data'), imported through Files or the share sheet

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None from LinkedIn's API. The member requests the archive at Settings & Privacy > Data privacy > Get a copy of your data. The app needs a file importer (document picker or share extension).
- **Data scope:** Connections in CSV or vCard. Expected fields are name, company, position and connection date, inferred from the DMA CONNECTIONS domain; the exact columns of Connections.csv are not verified. An email address appears only if that connection allows it. The larger archive includes 'connections, verifications, contacts, account history'; whether it includes messages is not verified.
- **Historical coverage:** Point-in-time snapshot at export. The connection date gives when each relationship started.
- **Refresh cadence:** Manual: only when the user exports again. Must be labelled a manual import, never automatic monitoring.
- **Restrictions:** 'The CSV and vCard formats don't support all characters' (Chinese, Japanese and Hebrew are listed as unsupported). Only 1st-degree connections.
- **Evidence:** The help center gives the steps; the download link arrives by email to the primary address. It warns that emails show only for connections who allow it and that CSV/vCard don't support every character set.
- **Next experiment:** Request a real archive from a test account and record the exact file names and columns. Write an on-device parser, then compare two exports taken about a month apart to detect job or company changes.
- **Docs:**
  - <https://www.linkedin.com/help/linkedin/answer/a566336/export-connections-from-linkedin>
  - <https://www.linkedin.com/help/linkedin/answer/a6214075>
  - <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain>

### Facebook / Meta

_The Graph API gives no usable view of the social graph or friends' updates. The DMA route pushes data into a server that the destination hosts. The realistic route is a manual JSON export._

#### `facebook-graph-user-friends` — Facebook Login with the Graph API user_friends permission

- **Status:** `unavailable` · **On-device feasible:** partial · **Backend required:** unknown · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** user_friends. Whether App Review applies was not shown in the fetched excerpt.
- **Data scope:** 'a list of a person's friends using that app', meaning only friends who also use LittleThings. No permission in the reference grants friends' posts (user_posts covers only the user's own timeline).
- **Historical coverage:** None.
- **Refresh cadence:** Not applicable.
- **Restrictions:** Allowed usage: 'Provide Facebook-related content to personalize a person's experience.'
- **Evidence:** The Permissions Reference says user_friends 'allows your app to get a list of a person's friends using that app.' The claim that friends' posts can't be read is an inference: no permission listed grants them.
- **Next experiment:** None. It cannot return the user's social graph or friends' life updates.
- **Docs:**
  - <https://developers.facebook.com/docs/permissions/reference/user_friends>

#### `facebook-graph-user-posts` — Graph API user_posts (the user's own timeline posts)

- **Status:** `blocked` · **On-device feasible:** partial · **Backend required:** unknown · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** user_posts
- **Data scope:** 'the posts that a user has made on their timeline'.
- **Historical coverage:** Unknown.
- **Refresh cadence:** Unknown.
- **Restrictions:** Allowed usage is limited to making physical or digital books or albums of timelines, and parental monitoring of under-18 dependents. A relationship-assistant use case is not listed.
- **Evidence:** The Permissions Reference lists allowed usage for user_posts as timeline books or albums and parental monitoring only.
- **Next experiment:** None. The use case does not match the allowed usage.
- **Docs:**
  - <https://developers.facebook.com/docs/permissions/reference/user_friends>

#### `facebook-dyi-export` — Meta Accounts Center 'Export your information' (Download Your Information) to the device in JSON, then imported into the app

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None from an API. The user creates a password-protected export and shares the ZIP into LittleThings.
- **Data scope:** 'content and info you've shared, your activity and info we collect'. Category names (Messages, Friends and so on) and the message JSON schema were not verified this session.
- **Historical coverage:** The user picks a date range, so the full history is possible.
- **Refresh cadence:** Manual. A finished export can be downloaded for 4 days.
- **Restrictions:** None found in the fetched pages. HTML or JSON format; media quality affects file size.
- **Evidence:** The Facebook Help Center describes the flow: Accounts Center > Your information and permissions > Export your information > Export to device, choosing info, date range, format and media quality. JSON is 'A machine readable format', and the export stays available for 4 days.
- **Next experiment:** Export JSON from a test account with Messages and Friends selected. Document the folder layout and the message JSON fields (sender, timestamp, content, text encoding are all not verified), then build an on-device parser.
- **Docs:**
  - <https://www.facebook.com/help/212802592074644>
  - <https://www.facebook.com/help/1701730696756992>

#### `meta-data-portability-dtp` — Meta Data Portability (DMA): become a destination in Export Your Information using the Data Transfer Project

- **Status:** `blocked` · **On-device feasible:** no · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** A Level 1 or Level 2 entry in the DTI Trust Registry, a verified Meta Business Manager account, a public privacy policy, an OAuth 2.0 authorization server, and Meta's onboarding review.
- **Data scope:** DTP data types are not listed on the fetched pages; photos are the example. Posts and messages are not mentioned.
- **Historical coverage:** Unknown.
- **Refresh cadence:** Unknown (one-time or recurring not stated).
- **Restrictions:** Meta pushes data to the destination: 'Meta's portability infrastructure needs to call your APIs on behalf of the user'. The destination must host write APIs (for example POST /V1/photo) and OAuth. Eligible regions not stated.
- **Evidence:** The EU DMA portal lists Meta's resources as the end-user DYI tool and the 'Data Portability Developer Guide'. That guide describes Meta's DTP worker calling the destination's hosted APIs, which needs a server.
- **Next experiment:** None under current constraints. Record it as a hard backend dependency, and check again if Meta publishes a pull-style DMA API.
- **Docs:**
  - <https://developers.facebook.com/docs/data-portability>
  - <https://developers.facebook.com/docs/data-portability/overview>
  - <https://digital-markets-act.ec.europa.eu/developer-portal/end-user-data-portability_en>

### Instagram

_There has been no consumer API since December 4, 2024. Only a manual export remains._

#### `instagram-api-professional` — Instagram API (Instagram Login, Facebook Login or Unified Login), including messaging and webhooks

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** unknown · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** An Instagram professional (Business or Creator) account. The Facebook Login route also needs a linked Facebook Page. App Review details were not verified.
- **Data scope:** For professional accounts: publishing, comments, mentions, insights, messaging, and webhooks for real-time notifications. Nothing is documented for personal accounts or for reading other users' feeds.
- **Historical coverage:** Not applicable for personal accounts.
- **Refresh cadence:** Webhooks deliver to a server (not applicable).
- **Restrictions:** The Instagram Basic Display API ended on December 4, 2024: 'there will no longer be a set of Instagram APIs for consumer developer apps.'
- **Evidence:** Meta's blog: 'Starting on December 4th, 2024, Instagram Basic Display API will no longer be available'. The replacements target business and creator accounts only.
- **Next experiment:** None. There is no consumer or personal-account API.
- **Docs:**
  - <https://developers.facebook.com/docs/instagram-platform>
  - <https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/>

#### `instagram-data-export` — Instagram 'Export your information' through Meta Accounts Center, imported into the app

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None from an API. The user creates the export in Accounts Center and shares the file into LittleThings.
- **Data scope:** Expected to match the Meta Accounts Center export (HTML or JSON). Instagram-specific categories (messages, followers/following) are not verified: the Instagram help page could not be fetched.
- **Historical coverage:** The user picks a date range (per the Accounts Center flow; Instagram-specific behavior not verified).
- **Refresh cadence:** Manual.
- **Restrictions:** Not verified.
- **Evidence:** Only the Facebook help article on the shared Accounts Center export was readable. https://help.instagram.com/181231772500920 came back empty, so the Instagram-specific details are unverified.
- **Next experiment:** Export JSON from a test Instagram account (messages, followers, following), document the schema, and reuse the Meta DYI parser.
- **Docs:**
  - <https://www.facebook.com/help/212802592074644>

### Email

_The strongest automatic, on-device conversation-rhythm source. Gmail and Microsoft Graph both support on-device public-client OAuth. Gmail read scopes are Restricted, so a public launch needs Google verification, but the CASA assessment is triggered only by server storage or transmission._

#### `email-gmail-api` — Gmail API called directly from the iOS app, with Google OAuth for installed apps (PKCE, no client secret)

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** gmail.metadata or gmail.readonly; both are classified 'Restricted'. A public launch needs restricted-scope OAuth app verification. A CASA security assessment applies only 'If you store or transmit restricted scope data on servers'.
- **Data scope:** gmail.metadata: headers and labels. gmail.readonly: full messages. (The scope semantics come from the scope names and were not re-read in detail.)
- **Historical coverage:** Expected to cover the whole mailbox through paging (not re-verified).
- **Refresh cadence:** Opportunistic: when the app opens, plus best-effort BGAppRefresh. Gmail server push was not investigated and would likely need cloud infrastructure.
- **Restrictions:** Apps in development or testing are exempt from verification but subject to a user cap. The Limited Use policy applies. A security assessment, if required, is renewed at least every 12 months.
- **Evidence:** The scopes page marks gmail.readonly and gmail.metadata Restricted, and requires a security assessment only when data is stored on or sent through servers. The native-app OAuth page says installed apps 'cannot keep secrets', recommends always using PKCE, and says client_secret 'is not applicable' for iOS clients.
- **Next experiment:** Create an iOS OAuth client in a test Google Cloud project (testing mode) and sign in with AppAuth or Google Sign-In using gmail.metadata. Fetch 90 days of headers on-device and compute per-contact cadence. Then file for restricted-scope verification and confirm that no CASA is needed because there is no server.
- **Docs:**
  - <https://developers.google.com/workspace/gmail/api/auth/scopes>
  - <https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification>
  - <https://developers.google.com/identity/protocols/oauth2/native-app>

#### `email-microsoft-graph` — Microsoft Graph /me/messages with delegated permissions from a public client (MSAL) on the device

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Mail.ReadBasic (least privileged), or Mail.Read or Mail.ReadWrite. Delegated permissions work for both work/school and personal Microsoft accounts. Admin-consent requirements for the Mail.* permissions were not verified (the permissions reference was truncated when read).
- **Data scope:** Messages in the signed-in user's mailbox. Bodies come back as HTML by default (a Prefer header can switch to text). Whether Mail.ReadBasic excludes bodies was not verified.
- **Historical coverage:** The whole mailbox through paging ($top from 1 to 1000).
- **Refresh cadence:** Opportunistic or best-effort background. Delta queries were not verified.
- **Restrictions:** Work tenants may restrict user consent (not verified).
- **Evidence:** List messages names Mail.ReadBasic as least privileged for both 'Delegated (work or school account)' and 'Delegated (personal Microsoft account)'. The Exchange OAuth page says MSAL client libraries can 'fetch an access token from your client application.'
- **Next experiment:** Register a multi-tenant public-client app that also allows personal accounts. Sign in with MSAL on iOS, list 90 days with $select=from,toRecipients,sentDateTime,subject, and check the consent screens for an outlook.com account and a default Microsoft 365 tenant.
- **Docs:**
  - <https://learn.microsoft.com/en-us/graph/api/user-list-messages>
  - <https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth>
  - <https://learn.microsoft.com/en-us/graph/permissions-reference>

#### `email-imap-oauth` — Generic IMAP with SASL XOAUTH2 (Outlook.com and Microsoft 365; Gmail through the https://mail.google.com/ scope)

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Microsoft: https://outlook.office.com/IMAP.AccessAsUser.All, plus offline_access for refresh tokens. Google: https://mail.google.com/ (Restricted, same verification as the Gmail API). Other providers were not investigated; avoid app-password flows, which mean handling credentials.
- **Data scope:** The full mailbox over IMAP.
- **Historical coverage:** The full mailbox.
- **Refresh cadence:** Only while the app runs or during best-effort background time. Persistent IMAP IDLE in the iOS background was not verified and is unlikely.
- **Restrictions:** Microsoft OAuth2 for IMAP 'is available for both Microsoft 365 ... and Outlook.com users.' The Google restricted-scope rules apply.
- **Evidence:** Microsoft documents the IMAP scope string and the XOAUTH2 SASL format. Google lists https://mail.google.com/ as a Restricted scope.
- **Next experiment:** Only if the Graph or Gmail REST APIs fall short: test XOAUTH2 against outlook.office365.com and imap.gmail.com with an on-device IMAP library, and compare battery and latency with the REST APIs.
- **Docs:**
  - <https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth>
  - <https://developers.google.com/workspace/gmail/api/auth/scopes>

#### `email-mailkit-mac` — Mac companion Mail extension (MailKit message action handler) observing messages as Apple Mail downloads them

- **Status:** `prototype` · **On-device feasible:** partial · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The user enables the Mail extension in Mail (the enablement flow was not verified). macOS 12+.
- **Data scope:** MEMessage gives from, to, cc, bcc, subject, dateSent, dateReceived, headers, and rawData ('The raw RFC 2822 header and body content'; rawData is optional and when it is nil is undocumented).
- **Historical coverage:** Unclear. Action handlers run 'when Mail downloads messages' (new mail). No bulk history access is documented.
- **Refresh cadence:** Event-driven while Mail runs on the Mac.
- **Restrictions:** macOS only, and only for people who use Apple Mail on a Mac. Getting results to the iPhone without a product backend needs a design decision, for example the user's own iCloud private database (not investigated).
- **Evidence:** MailKit lists macOS 12.0 as its only platform. A message action handler 'performs actions such as flagging, setting colors, or archiving when Mail downloads messages'.
- **Next experiment:** Build a MailKit extension on macOS 26 that logs MEMessage headers for incoming mail. Check whether rawData is populated and whether the handler sees messages from every account.
- **Docs:**
  - <https://developer.apple.com/documentation/mailkit>
  - <https://developer.apple.com/documentation/mailkit/memessage>

#### `email-apple-mail-ios` — Reading Apple Mail on iPhone

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Not applicable.
- **Data scope:** None.
- **Historical coverage:** None.
- **Refresh cadence:** Not applicable.
- **Restrictions:** MailKit is macOS-only. No iOS API for reading Mail data was found.
- **Evidence:** MailKit's platform list shows only macOS 12.0.
- **Next experiment:** None. Use Gmail, Graph or IMAP OAuth for the underlying account instead.
- **Docs:**
  - <https://developer.apple.com/documentation/mailkit>

### iMessage / SMS

_No supported route reads Messages history on iOS or macOS. TelephonyMessagingKit is EU-only and requires replacing the user's SMS app. Mac access to chat.db works only through an undocumented private store and is not App Store compatible. Only user-shared content is viable._

#### `imessage-sms-ios-history-read` — A third-party iOS app reading Messages (iMessage or SMS) history

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Not applicable.
- **Data scope:** None.
- **Historical coverage:** None.
- **Refresh cadence:** Not applicable.
- **Restrictions:** No public API. Apple DTS points only to TelephonyMessagingKit, which has its own limits (see imessage-sms-telephonymessagingkit).
- **Evidence:** DTS (thread 804040): 'macOS doesn't have an API for accessing the user's SMS messages' and, for iOS, TelephonyMessagingKit 'comes with its own limitations'. The TelephonyMessagingKit docs describe no access to existing history or to iMessage.
- **Next experiment:** File an enhancement request through Feedback Assistant, as DTS suggests, describing a consented, on-device, per-contact metadata read. Nothing to build.
- **Docs:**
  - <https://developer.apple.com/forums/thread/804040>
  - <https://developer.apple.com/documentation/telephonymessagingkit>

#### `imessage-sms-telephonymessagingkit` — TelephonyMessagingKit: LittleThings becomes the user's default carrier messaging app (SMS, MMS, RCS)

- **Status:** `blocked` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The com.apple.developer.carrier-messaging-app entitlement, and the user must select the app as default carrier messaging app. Check TelephonyMessagingSession.isConfiguredForCarrierMessaging before use.
- **Data scope:** While the app is the default, 'the system sends all SMS, MMS, and RCS messages received by the device to your app', and the app can send through smsService, mmsService and rcsService. iMessage is not covered.
- **Historical coverage:** Only messages queued while the app wasn't running, plus new ones. Earlier history is not described. Queued messages 'may' be discarded if the app doesn't fetch them in time.
- **Refresh cadence:** Real time: the system launches the app in the background when a message arrives.
- **Restrictions:** iOS 26+, iPhone only. 'People using your app must have an account registered in the European Union (EU), and their device must be located within the EU.' LittleThings would have to become a full replacement SMS/RCS client.
- **Evidence:** The framework is for the default carrier messaging app and sends and receives 'standards-based messages over cellular networks'. Users must be EU-registered and in the EU. This is the only documented programmatic SMS send route on iOS.
- **Next experiment:** Product decision only. An EU-only full SMS client is outside the product's scope; revisit if Apple expands the regions. If it is ever pursued, develop with the Apple-provided provisioning profile, which works in all regions for testing.
- **Docs:**
  - <https://developer.apple.com/documentation/telephonymessagingkit>
  - <https://developer.apple.com/documentation/telephonymessagingkit/creating-a-carrier-messaging-app>
  - <https://developer.apple.com/forums/thread/804040>

#### `imessage-sms-default-messaging-app` — Default (internet) messaging app entitlement, com.apple.developer.messaging-app (iOS 18.2+)

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The com.apple.developer.messaging-app entitlement plus the im: URL scheme.
- **Data scope:** It lets the app open im: links as the default messaging app. Nothing on the page grants access to Messages or iMessage data.
- **Historical coverage:** None.
- **Refresh cadence:** Not applicable.
- **Restrictions:** The page mentions no regional limits. It is for apps that are themselves messaging services.
- **Evidence:** 'In iOS and iPadOS 18.2 and later, a person may select an app other than the Messages app to send instant messages.' The page covers only im: and sms: URL handling.
- **Next experiment:** None.
- **Docs:**
  - <https://developer.apple.com/documentation/messages/preparing-your-app-to-be-the-default-messaging-app>

#### `imessage-sms-filter-extension` — SMS/MMS message filter extension (IdentityLookup, ILMessageFilterExtension)

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The user enables the filter in Settings (flow not re-verified).
- **Data scope:** Only SMS and MMS from unknown senders. It 'doesn't work with messages from senders in a user's Contacts list or with iMessage messages'.
- **Historical coverage:** None.
- **Refresh cadence:** Per incoming unknown-sender message.
- **Restrictions:** The extension 'can't access the network directly' and 'can't write data to containers shared with the containing app'.
- **Evidence:** The IdentityLookup docs limit filtering to unknown senders, exclude iMessage, and block both networking and writes to the shared container, by design for privacy.
- **Next experiment:** None. It sees no messages from known contacts and cannot pass data to the app.
- **Docs:**
  - <https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering>

#### `imessage-sms-mac-chatdb-fda` — Mac companion reading the Messages database (~/Library/Messages) with user-granted Full Disk Access

- **Status:** `blocked` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Full Disk Access (a user-granted privacy setting) in an app that is not sandboxed, so it would ship with Developer ID outside the Mac App Store.
- **Data scope:** Possibly the full Messages history synced to the Mac (iMessage plus relayed SMS). Not tested.
- **Historical coverage:** Possibly the full history. Not tested.
- **Refresh cadence:** Possibly near real time by watching the database. Not tested.
- **Restrictions:** DTS (March 2024): 'There's no API to do that. Moreover, the location and format of the message database is not considered API'. Mac App Store apps must be sandboxed (2.4.5(i)) and may not read outside their container (2.5.2). A search snippet says Full Disk Access does not lift sandbox restrictions.
- **Evidence:** Full Disk Access is a real, user-granted permission, so this does not get around access control. But it depends on a private database format that Apple says is 'not considered API', and it can't pass App Store sandboxing. We class it as blocked: unsupported, not a sanctioned integration.
- **Next experiment:** Do not build. Treat it as a product and legal decision: it reads another app's undocumented private store and can't ship on the Mac App Store. If it is ever reconsidered, get legal review first.
- **Docs:**
  - <https://developer.apple.com/forums/thread/748291>
  - <https://developer.apple.com/forums/thread/804040>
  - <https://developer.apple.com/app-store/review/guidelines/>
  - <https://developer.apple.com/forums/thread/124895>

#### `imessage-sms-mac-applescript` — Mac companion scripting the Messages app with AppleScript (Apple Events)

- **Status:** `unavailable` · **On-device feasible:** partial · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Automation (Apple Events) permission to control Messages. Sandbox and App Store implications not verified.
- **Data scope:** Apple DTS says it is limited and probably does not expose individual messages.
- **Historical coverage:** Probably none.
- **Refresh cadence:** Not applicable.
- **Restrictions:** Not verified.
- **Evidence:** DTS: 'Messages has an AppleScript interface... I don't think it offers access to the individual messages', and in thread 804040 scripting Messages is 'quite limited'.
- **Next experiment:** Optional one-hour check: open the Messages scripting dictionary on macOS 26 and confirm whether message content or timestamps are exposed.
- **Docs:**
  - <https://developer.apple.com/forums/thread/748291>
  - <https://developer.apple.com/forums/thread/804040>

#### `imessage-sms-user-share-capture` — The user shares a screenshot or selected text of a conversation into LittleThings (share extension), with on-device Vision OCR

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None beyond the user choosing LittleThings in the share sheet.
- **Data scope:** Only what the user chooses to share at that moment.
- **Historical coverage:** Only what is visible or selected.
- **Refresh cadence:** Manual and user-initiated every time. Never label it automatic monitoring.
- **Restrictions:** None found.
- **Evidence:** A Share extension receives 'the user's initial text and any attachments'. RecognizeTextRequest recognizes text in an image (iOS 18+). The fetched page does not say it runs on-device.
- **Next experiment:** Build a share-extension spike that accepts images and text, run RecognizeTextRequest on a Messages screenshot in airplane mode, and measure how accurately sender and timestamp segments come out.
- **Docs:**
  - <https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html>
  - <https://developer.apple.com/documentation/vision/recognizetextrequest>

### WhatsApp

_The only personal-chat route is the manual per-chat export. The Business Platform is for businesses and needs a webhook server._

#### `whatsapp-chat-export` — WhatsApp per-chat 'Export chat' on iPhone, shared into LittleThings through the share sheet

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None from an API. The user exports each chat and picks LittleThings in the share sheet.
- **Data scope:** One chat's text history, optionally with the most recent media as attachments. Search snippets describe a text file in one place and a ZIP in another.
- **Historical coverage:** The chat history at export time. Message-count caps were not verified.
- **Refresh cadence:** Manual, per chat. Must be labelled a manual import.
- **Restrictions:** Per chat and user-initiated. The export 'can't be re-imported because it's a text file and not a backup file'. Regional availability was not verified.
- **Evidence:** Evidence comes only from search-result snippets of the WhatsApp FAQ (steps, the 'Without media' and 'Include media' options, 'the most recent media sent will be added as attachments'). The FAQ page itself returned only its title.
- **Next experiment:** Export a one-to-one and a group chat, with and without media, from WhatsApp on iOS. Confirm a LittleThings share extension appears and what it receives (ZIP or .txt), document the line format and date-locale variants, and build the parser.
- **Docs:**
  - <https://faq.whatsapp.com/1180414079177245/?locale=kk_KZ&cms_platform=android>

#### `whatsapp-business-platform` — WhatsApp Business Platform (Cloud API)

- **Status:** `blocked` · **On-device feasible:** no · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** A Meta business portfolio and a business phone number registered on the platform.
- **Data scope:** Messages that users send to the business's own number. It does not reach a person's personal WhatsApp chats.
- **Historical coverage:** None for personal chats.
- **Refresh cadence:** Webhooks, delivered to a server.
- **Restrictions:** Business-only. 'the contents of any message sent from a WhatsApp user to your business phone number is communicated via webhook' and webhooks 'deliver JSON payloads to your server'.
- **Evidence:** The Cloud API overview says 'You must have a business portfolio to use the platform' and that incoming messages arrive by webhook at your server.
- **Next experiment:** None. It is the wrong product (business messaging) and needs a server.
- **Docs:**
  - <https://developers.facebook.com/docs/whatsapp/cloud-api/overview>

#### `whatsapp-mac-desktop` — Reading WhatsApp Mac or desktop app data from a Mac companion

- **Status:** `unavailable` · **On-device feasible:** no · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Not applicable.
- **Data scope:** No public API found. Reading the desktop app's local store would put it in the same class as imessage-sms-mac-chatdb-fda (an undocumented private store).
- **Historical coverage:** Per FAQ snippets, the desktop apps sync more history than WhatsApp Web, but the full history lives on the phone.
- **Refresh cadence:** Not applicable.
- **Restrictions:** An account-information report can't be requested from the Mac app (FAQ snippet).
- **Evidence:** Only search-result snippets of WhatsApp FAQ pages were seen. No developer API for desktop chat data appeared in any source.
- **Next experiment:** None. For capture on the Mac, use user-initiated screen capture or the share/Services route instead.
- **Docs:**
  - <https://faq.whatsapp.com/653480766448040/>
  - <https://faq.whatsapp.com/526463418847093/?locale=en_US&cms_platform=web>

### Desktop capture (Mac companion)

_Only user-initiated capture paths fit the constraints. Accessibility-based reading of other apps is ruled out._

#### `desktop-screencapturekit-ocr` — Mac companion: user-initiated capture through the system picker (SCContentSharingPicker, ScreenCaptureKit), then on-device Vision OCR

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Screen-recording permission with the NSScreenCaptureUsageDescription key. Whether capturing only through the picker avoids the Screen Recording permission prompt was not verified.
- **Data scope:** Pixels of the window or display the user picks, at that moment.
- **Historical coverage:** Only what is on screen at capture time.
- **Refresh cadence:** Manual and user-initiated.
- **Restrictions:** Must stay user-initiated for each capture to avoid hidden scraping. Whether provider terms allow capturing their web pages was not verified. Sandbox and App Store compatibility was not verified.
- **Evidence:** Apple says to 'Request screen recording permission from the person before capturing content' and recommends SCContentSharingPicker 'as the recommended approach for letting people select content sources'.
- **Next experiment:** Spike on macOS 26: present SCContentSharingPicker, grab one frame of a Messages or WhatsApp window with SCScreenshotManager, and OCR it with RecognizeTextRequest offline. Record which permission prompts appear and whether a sandboxed build works.
- **Docs:**
  - <https://developer.apple.com/documentation/screencapturekit>
  - <https://developer.apple.com/documentation/screencapturekit/sccontentsharingpicker>
  - <https://developer.apple.com/documentation/vision/recognizetextrequest>

#### `desktop-accessibility-api` — Mac companion reading other apps' on-screen text through the Accessibility (AX) API

- **Status:** `blocked` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The Accessibility privilege (user-granted).
- **Data scope:** The UI text of other apps.
- **Historical coverage:** Only what is rendered.
- **Refresh cadence:** Could run continuously, which is exactly the hidden-scraping pattern the product rules forbid.
- **Restrictions:** Search snippets attribute to Apple DTS: 'We do not support the Accessibility APIs in sandboxed apps' (not confirmed on an opened page). Developers report rejections under guideline 2.4.5 for non-accessibility uses. The Mac App Store requires sandboxing.
- **Evidence:** DTS in thread 707680 points sandboxed apps to Input Monitoring for event taps (available 'even [to] apps published on the Mac App Store'). That does not help read UI text. The claim that Accessibility is unsupported in the sandbox comes from search snippets only.
- **Next experiment:** None. Use the picker-based capture or the share/Services route.
- **Docs:**
  - <https://developer.apple.com/forums/thread/707680>
  - <https://developer.apple.com/app-store/review/guidelines/>

#### `desktop-share-services` — Mac companion share extension or Services-menu item: the user selects text in any app and sends it to LittleThings

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None beyond the user invoking it.
- **Data scope:** The text, links or images the user selects.
- **Historical coverage:** Only what is selected.
- **Refresh cadence:** Manual and user-initiated.
- **Restrictions:** None found. Services-menu behavior was not verified this session.
- **Evidence:** The extension context carries 'the user's initial text and any attachments for a post, such as links, images, or videos'.
- **Next experiment:** Build a macOS share extension plus an NSServices entry that accept text, and verify they appear for selections in Messages, WhatsApp and Safari on macOS 26.
- **Docs:**
  - <https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html>

#### `desktop-browser-extension` — User-initiated Safari Web Extension that captures the current page when the user clicks

- **Status:** `not investigated` · **On-device feasible:** partial · **Backend required:** no · **Tested in app:** no · **Verified on:** —
- **Required permission:** Not investigated.
- **Data scope:** Not investigated.
- **Historical coverage:** Not investigated.
- **Refresh cadence:** Must be user-initiated if built.
- **Restrictions:** Provider terms on automated collection (LinkedIn, Meta) must be checked before any build. Not investigated.
- **Evidence:** Out of scope for this pass, per the brief: a separate feasibility path.
- **Next experiment:** Separate feasibility study: Safari Web Extension permission model (per-site grant on click), and LinkedIn's and Meta's terms on user-initiated page capture.
- **Docs:** none (not investigated)

### Platform capabilities

_On-device building blocks the app depends on. Cross-references: the LinkedIn DMA API is `linkedin-dma-portability-api` and the Meta DMA route is `meta-data-portability-dtp`. EventKit full and write-only access are the two `calendar-*` rows._

#### `platform-foundation-models` — Apple Foundation Models on-device LLM (SystemLanguageModel)

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** No user permission. Apple Intelligence must be enabled on an eligible device. iOS, iPadOS, macOS and visionOS 26+.
- **Data scope:** On-device summarizing, entity extraction, classification and tagging (a contentTagging use case exists). Context of 4,096 tokens per session, counting instructions, prompts and outputs together.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable. One request at a time per session.
- **Restrictions:** 'Model availability depends on whether the device and region supports Apple Intelligence.' Unavailable reasons: deviceNotEligible, appleIntelligenceNotEnabled, modelNotReady. Check languages with supportedLanguages or supportsLocale(_:). The model changes with OS updates (versions 26.0-26.3, 26.4, 27.0). PrivateCloudComputeLanguageModel (iOS 27+) is an explicit opt-in server model; it breaks the no-cloud-AI rule and must not be used.
- **Evidence:** 'the system model supports up to 4,096 tokens'. The UnavailableReason enum has three cases. The PCC article says PCC is used only when a session is created with PrivateCloudComputeLanguageModel, and lists SystemLanguageModel as 'Works offline'.
- **Next experiment:** Run an availability and supportsLocale matrix on test devices (eligible, ineligible, Apple Intelligence off). Benchmark guided-generation 'life update' extraction on chunks of about 3.5k tokens, and design a rule-based fallback for ineligible devices.
- **Docs:**
  - <https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models>
  - <https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel>
  - <https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/availability-swift.enum/unavailablereason>
  - <https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute>

#### `platform-speechanalyzer` — On-device speech-to-text with SpeechAnalyzer and SpeechTranscriber (iOS 26+)

- **Status:** `prototype` · **On-device feasible:** partial · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Microphone permission for live capture (speech-permission requirements for this API not verified). Locale assets are installed through AssetInventory.
- **Data scope:** Transcripts of live or file audio. Locales listed in the page metadata: de-DE, en-US, es-419, fr-FR, it-IT, ja-JP, ko-KR, pt-BR, zh-CN.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** SpeechTranscriber.isAvailable depends on 'the device's hardware and capabilities'. DictationTranscriber is the fallback for older devices. Too many concurrent analyses throw insufficientResources. The fetched pages do NOT say outright that processing stays on-device.
- **Evidence:** The API exists on iOS, iPadOS and macOS 26.0+, with installedLocales and supportedLocales checks and asset downloads. On-device-only processing is implied by the asset model but not stated on the pages fetched.
- **Next experiment:** In airplane mode on iOS 26, install en-US assets through AssetInventory, transcribe a 2-minute voice note, and confirm it works without network. Repeat on an older device with DictationTranscriber.
- **Docs:**
  - <https://developer.apple.com/documentation/speech/speechtranscriber>
  - <https://developer.apple.com/documentation/speech/speechanalyzer>

#### `platform-sfspeechrecognizer-ondevice` — SFSpeechRecognizer with requiresOnDeviceRecognition = true, gated on supportsOnDeviceRecognition

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Speech-recognition and microphone permissions (keys not re-verified).
- **Data scope:** Transcripts. 'on-device requests won't be as accurate.'
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** The request honors requiresOnDeviceRecognition only if supportsOnDeviceRecognition is true. Otherwise 'the SFSpeechRecognizer requires a network', so the app must refuse to transcribe rather than fall back to the server.
- **Evidence:** requiresOnDeviceRecognition: 'Set this property to true to prevent an SFSpeechRecognitionRequest from sending audio over the network.'
- **Next experiment:** Implement a hard gate: if supportsOnDeviceRecognition is false for the locale, disable voice capture. Test with en-US and one less common locale.
- **Docs:**
  - <https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition>
  - <https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition>

#### `platform-vision-ocr` — Vision text recognition (RecognizeTextRequest; iOS 18+, macOS 15+)

- **Status:** `prototype` · **On-device feasible:** partial · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None.
- **Data scope:** Text from images, with recognitionLanguages, automaticallyDetectsLanguage, usesLanguageCorrection and customWords settings.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** The fetched page does not state on-device processing, and it does not list language cases (see supportedRecognitionLanguages).
- **Evidence:** 'An image-analysis request that recognizes text in an image.' Available on iOS 18.0, macOS 15.0 and visionOS 2.0.
- **Next experiment:** Run OCR on 20 chat screenshots in airplane mode, record accuracy and latency, and log supportedRecognitionLanguages on iOS 26.
- **Docs:**
  - <https://developer.apple.com/documentation/vision/recognizetextrequest>

#### `platform-share-extension` — iOS and macOS Share extension receiving text, URLs, images and files from other apps

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None. The user picks the extension in the share sheet.
- **Data scope:** 'the user's initial text and any attachments for a post, such as links, images, or videos'.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Manual.
- **Restrictions:** The extension must 'Prepare to be terminated by the system'. The activation-rule docs could not be fetched (404), and memory limits were not verified.
- **Evidence:** Apple's App Extension Programming Guide (archived) describes the Share extension context. Sending data to the containing app through App Groups is standard but was not re-verified this session.
- **Next experiment:** Build a share extension that writes into an App Group container and test receiving WhatsApp export ZIPs, LinkedIn CSVs and screenshots.
- **Docs:**
  - <https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html>

#### `platform-messageui-composer` — MessageUI MFMessageComposeViewController (prefilled iMessage/SMS that the user sends)

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None. Check canSendText() first.
- **Data scope:** Sends one prefilled message after the user approves it.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** It cannot send unattended: it 'only lets you construct the initial message and present it for a person's approval'. The delegate reports cancelled, sent or failed, and sent means 'The user successfully queued or sent the message' (not delivered). App Review 5.1.2(v) requires showing how the message will look to the recipient.
- **Evidence:** 'The composition interface doesn't guarantee the delivery of your message.' The MessageComposeResult.sent description says 'queued or sent'.
- **Next experiment:** Use it for the 'reach out' action. Log only the sent, cancelled or failed result locally, and never treat sent as delivered.
- **Docs:**
  - <https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller>
  - <https://developer.apple.com/documentation/messageui/messagecomposeresult>
  - <https://developer.apple.com/app-store/review/guidelines/>

#### `platform-shortcuts-automation-send` — User-configured Shortcuts personal automation (for example Time of Day or Message trigger, then Send Message), with LittleThings supplying text through an App Intent

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** The user builds the automation in the Shortcuts app and turns off 'Ask Before Running'. The app can't create it on the user's behalf (not verified, but no API for that was found).
- **Data scope:** Whatever text the App Intent returns, sent by Shortcuts' Send Message action.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** When the trigger fires.
- **Restrictions:** The current Apple guide lists Time of Day, Message, Email and others among triggers that can run automatically, but warns 'You may also need to set individual actions to run automatically.' Whether Send Message runs without a prompt on iOS 26 is not verified; community reports conflict. App Review 5.1.2(v) still applies to app-initiated contact.
- **Evidence:** Apple's guide: 'turn off Ask Before Running, then tap Don't Ask'. MacMost (2022, third party) shows a Time of Day plus Send Message automation sending without asking. This is the only possible unattended-send route that works outside the EU, and it is configured by the user, not the app.
- **Next experiment:** On an iOS 26 device, build a Time of Day automation (Ask Before Running off) that runs a test App Intent returning text into Send Message to a second test phone. Record any confirmation UI, the lock-screen behavior, and the result.
- **Docs:**
  - <https://support.apple.com/en-gb/guide/shortcuts/apd602971e63/ios>
  - <https://macmost.com/how-to-schedule-a-text-message-on-an-iphone.html>

#### `platform-contacts-limited-access` — Contacts limited access: ContactAccessButton and contactAccessPicker (iOS 18+)

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Works when authorization is .limited or none. The button doesn't appear when access is already full.
- **Data scope:** Lets the person grant access to more individual contacts from inside the app's search UI.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** iOS, iPadOS and Mac Catalyst 18.0+.
- **Evidence:** 'If a single contact matches, the button shows that contact's name and image, and tapping the button grants your app access to that contact.' contactAccessPicker presents a picker of all contacts.
- **Next experiment:** Make limited access the default onboarding path, with ContactAccessButton bound to the 'add person' search field. Measure how many contacts users grant.
- **Docs:**
  - <https://developer.apple.com/documentation/contactsui/contactaccessbutton>

#### `platform-local-notification-limit` — UNUserNotificationCenter local notifications: limit on pending requests

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Notification authorization.
- **Data scope:** At most 64 pending or active notification requests per app.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** The app must refill the queue opportunistically (on launch or in background tasks).
- **Restrictions:** The limit comes from an Apple engineer on the Developer Forums (January 2026), not from reference docs. Behavior when more than 64 are scheduled is unconfirmed.
- **Evidence:** An Apple engineer wrote: 'Yes, there is a limit of 64 for how many simultaneous notification requests can be active/pending at one time per app. This is a system limit and there is no way around it.'
- **Next experiment:** Schedule only the nearest ~60 reminders and refill on launch and during BGAppRefresh. Add a test that schedules 70 and records which ones survive on iOS 26.
- **Docs:**
  - <https://developer.apple.com/forums/thread/811171>

#### `platform-bgtaskscheduler` — BGTaskScheduler background refresh and processing

- **Status:** `verified` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** Background-modes capability and registered task identifiers (not re-verified).
- **Data scope:** Lets the app run code for sync, OCR or LLM batches while suspended.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Best effort: 'the system doesn't guarantee launching the task at the specified date, but only that it won't begin sooner.'
- **Restrictions:** Frequency, the effect of force-quit, and Low Power Mode behavior were not verified on the fetched pages. BGContinuedProcessingTaskRequest exists (referenced) but was not investigated.
- **Evidence:** The earliestBeginDate docs state that execution time is not guaranteed.
- **Next experiment:** Instrument BGAppRefreshTask and BGProcessingTask launch times on 3 test phones for 2 weeks, so the product never promises timely automatic capture.
- **Docs:**
  - <https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler>
  - <https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate>

#### `platform-apple-pay-merchant-handoff` — Gift purchase by handing off to the merchant's own checkout (open the merchant URL in Safari or SFSafariViewController)

- **Status:** `prototype` · **On-device feasible:** yes · **Backend required:** no · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** None.
- **Data scope:** Only the merchant URL leaves the app.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** Whether Apple Pay on the web works inside SFSafariViewController was not verified. The merchant is the payment party, so LittleThings needs no merchant ID or payment provider.
- **Evidence:** The planning page says the merchant or its payment provider decrypts and processes the payment token. With a handoff, that stays entirely with the merchant.
- **Next experiment:** Open three common gift merchants' product pages in SFSafariViewController and confirm their Apple Pay web checkout is offered and completes.
- **Docs:**
  - <https://developer.apple.com/apple-pay/planning/>

#### `platform-apple-pay-in-app` — In-app Apple Pay, with LittleThings as the merchant

- **Status:** `blocked` · **On-device feasible:** no · **Backend required:** yes · **Tested in app:** no · **Verified on:** 2026-11-02
- **Required permission:** A merchant ID, a payment processing certificate, and a payment service provider (PSP).
- **Data scope:** Payment token plus shipping and contact details.
- **Historical coverage:** Not applicable.
- **Refresh cadence:** Not applicable.
- **Restrictions:** 'Once decrypted, the token needs to be passed to the payment service provider for processing.' Decryption is done 'by the merchant with the certificate private key or by the Payment Service Provider'. Goods rules are in App Review 3.1, which was not checked on the fetched page.
- **Evidence:** The planning page describes the encrypted payment token going to the merchant or PSP for decryption and processing, so it needs either the merchant's own server or a third-party PSP backend.
- **Next experiment:** None unless LittleThings becomes a merchant. Record the PSP and merchant processing as a backend dependency.
- **Docs:**
  - <https://developer.apple.com/apple-pay/planning/>

## Prioritized experiments

Ordered by expected value for **automatic** capture of life updates and conversation rhythm with acceptable privacy, then by how cheap they are to run.

1. **`email-gmail-api`** — Gmail metadata spike on-device (testing-mode OAuth client, gmail.metadata, 90-day per-contact cadence). It is the largest automatic rhythm source with no backend. Start Google restricted-scope verification early, because review time sets the launch date.
2. **`email-microsoft-graph`** — Microsoft Graph Mail.ReadBasic spike with MSAL (outlook.com and a default Microsoft 365 tenant). Covers the second large mail population, with no restricted-scope review.
3. **`calendar-eventkit-full-access`** — Calendar and Contacts rhythm spike: match event attendees to (limited-access) contacts and compute per-person meeting cadence. Needs no external approval at all.
4. **`platform-foundation-models`** — Foundation Models gate: availability and locale matrix on real devices, plus a benchmark of chunked (<4k token) life-update extraction with guided generation. Every inference feature depends on it. Pair it with the `platform-sfspeechrecognizer-ondevice` and `platform-speechanalyzer` airplane-mode checks for voice notes.
5. **`whatsapp-chat-export`** — WhatsApp export plus share extension parser. This is the most realistic messaging-rhythm source, though manual (it must be labelled a manual import).
6. **`linkedin-data-archive-import`** — LinkedIn archive import and diff: confirm the Connections.csv columns, then compare two exports to surface job and company changes as life updates (manual).
7. **`facebook-dyi-export`** — Meta DYI JSON import for Facebook and Instagram (messages, friends, followers). Document the schema and build one parser for both exports (manual).
8. **`platform-shortcuts-automation-send`** — Shortcuts unattended-send test on iOS 26 (Time of Day automation with Ask Before Running off, an App Intent supplying the text, then Send Message). This decides whether any user-configured unattended send exists outside the EU.
9. **`email-mailkit-mac`** — Mac companion probes: a MailKit message-action extension (automatic metadata for Apple Mail users) and `desktop-screencapturekit-ocr` (user-initiated picker capture plus offline OCR).

## Could not verify

### Claims left unverified

- WhatsApp export details: exact message caps, whether it's a ZIP or a .txt on current iOS, and any countries where export is disabled. The FAQ page returned only its title, and the snippets conflict.
- Instagram-specific export categories and format (help page came back empty). The Instagram Postman documentation did not render.
- Meta DYI: whether Messenger messages and friends are separate selectable categories, and the JSON message schema (field names, text encoding).
- LinkedIn archive: exact `Connections.csv` column names, and whether the larger archive includes messages. The column list comes from the DMA CONNECTIONS domain description and third-party snippets.
- LinkedIn: whether a public client (PKCE, no client_secret) is allowed for any product. The 1-year DMA consent duration appeared only in a search snippet.
- Meta Data Portability (DTP): eligible regions, data types (posts or messages), and whether transfers are one-time or recurring.
- Whether SpeechAnalyzer/SpeechTranscriber and Vision RecognizeTextRequest run strictly on-device. The fetched pages don't say so explicitly.
- Whether capturing through SCContentSharingPicker avoids the Screen Recording permission prompt, and whether ScreenCaptureKit works in a sandboxed Mac App Store app.
- That the Accessibility API is unsupported in sandboxed apps (search snippets attributed to DTS only; thread 707680 does not say it), and that Full Disk Access does not lift sandbox restrictions (snippet of thread 124895, not opened).
- Microsoft Graph: admin-consent requirements for Mail.Read and Mail.ReadBasic (the permissions reference was truncated before those entries), MSAL iOS public-client specifics, and delta queries.
- Gmail: the incremental-sync (history) API and whether any push mechanism works without a server. Also the redirect-URI mechanism for the iOS client type (the native-app page says custom URI schemes are 'no longer supported' in a general context and points iOS developers to Google Sign-In or AppAuth).
- Shortcuts: whether the Send Message action still asks for confirmation in an automation set to not ask, on iOS 26, and which iOS version the fetched en-gb guide describes. An earlier version of the guide listed Time of Day as unable to run automatically.
- The 64 pending-notification limit appears only in an Apple engineer's forum reply, not in reference documentation. What happens beyond 64 is undocumented.
- BGAppRefreshTask/BGProcessingTask frequency, force-quit behavior, Low Power Mode behavior, and BGContinuedProcessingTask details.
- Whether Apple Pay on the web works inside SFSafariViewController, and the App Review 3.1 rules for physical versus digital goods.
- Contacts change history (CNChangeHistoryFetchRequest) and EventKit change notifications, which would allow incremental refresh.
- Whether `user_friends` needs App Review (that column wasn't in the fetched excerpt).
- The Messages AppleScript dictionary contents on macOS 26.
- The user-initiated Safari Web Extension path: not investigated.

### URLs that failed to fetch or returned no usable body

- <https://support.apple.com/guide/iphone/control-access-to-information-in-apps-iph251e92810/ios> — returned only the guide's table of contents, no article body
- <https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api> — rendered only the word 'Postman' (JS app)
- <https://faq.whatsapp.com/1180414079177245> — truncated to the title only
- <https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone&locale=en_US> — truncated to the title only
- <https://help.instagram.com/181231772500920> — returned only 'Help Center'
- <https://support.apple.com/guide/shortcuts/apd602971e63/ios> — table of contents only (the en-gb variant loaded)
- <https://developer.apple.com/tutorials/data/documentation/foundation/nsextensionattributes-activationrule.json> — HTTP 404

Partially read (used only for the parts that loaded):

- <https://learn.microsoft.com/en-us/graph/permissions-reference> — 578k characters; only the first 100k were read, which did not reach the Mail.* entries.
- <https://www.facebook.com/help/1701730696756992> — index page only; details came from help article 212802592074644.
- <https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler> — class reference only, with no scheduling semantics; those came from the `earliestBeginDate` page.
