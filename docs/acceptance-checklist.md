# Acceptance checklist

Status of every PRD acceptance criterion as of 2026-11-02.

- **Passed (logic)**: verified by automated tests of the core package (run on Linux locally and
  in CI on Linux and macOS). The app layer that wires it to the UI has not run on a device.
- **Passed (build)**: the code compiles for the iOS Simulator in CI; behavior not exercised.
- **Passed (simulator)**: exercised by a UI test running the real app in the iOS Simulator in CI
  (in-memory key store and notification fakes via `-ui-testing`; no Keychain, permissions or
  network involved).
- **Not tested (device)**: requires a physical iPhone and/or Xcode run that has not happened.
- **Not built**: not implemented in this iteration.
- **Failed**: tested and not meeting the criterion.

Test references use `Target/Suite.test`. "Fixtures" are the PRD §11 synthetic people.

## Phase gates

| Gate | Status | Evidence |
|---|---|---|
| Phase 1: records survive restart, DB not readable as plaintext, manual operation works without permissions and network | Passed (logic) and manual operation passed (simulator); device not tested | `LTVaultTests/recordsSurviveRestart`, `databaseFileContainsNoPlaintext`, `wrongKeyFailsClosedAndLeavesDataIntact`; `LTAppCoreTests/onboardingWorksWithoutAnyPermission`, `recordsSurviveRestartAndUnlockRequiresAuthentication` |
| Phase 2: date and rule edge cases pass; every card explains its evidence | Passed (logic) | `LTDomainTests` date suite (16 tests); `LTSuggestionsTests` (33); `everyCardExplainsItselfWithoutAModel` |
| Phase 3: denial/revocation/cancellation accurate; no invented interactions; no hidden cloud calls | Passed (logic) for calendar denial, import revocation, draft cancel; privacy guards in CI. Contacts/Calendar/Notifications on device: not tested | `calendarRefreshHonorsDeniedAccessAndUpdatesMovedEvents`, `revokingAnImportStopsCaptureAndCanDeleteCopies`, `draftCancelAndSendOutcomesAreRecordedPrecisely`, `scripts/privacy-guards.sh` |
| Phase 4: P0 acceptance passes or blockers documented | Partially: logic passes; device verification, accessibility audit, performance and network inspection are documented blockers | This file; `docs/handoff.md` |
| Phase 5: evidence-backed automatic capture for stated coverage | **Not met.** Only manual imports (WhatsApp, LinkedIn) and share capture exist; no automatic connector is built | `docs/integrations/capability-matrix.md` |

## FR1 People and contact import

| Criterion | Status | Evidence |
|---|---|---|
| Permission denial leaves manual use functional | Passed (logic) | Manual add needs no permission (`onboardingWorksWithoutAnyPermission`); contact picker needs no permission (by design; device not tested) |
| Selecting two contacts imports only those two | Passed (logic); picker not tested (device) | `contactImportBringsOnlySelectedContactsAndReviewsBirthdays` |
| Names and numbers survive restart | Passed (logic) | `recordsSurviveRestart` (phone number asserted) |
| Revocation stops future reads | Not tested (device) | `SystemContactsProvider` returns nothing unless `canRead` |
| Deleting a local record does not alter the system address book | Passed by construction | No Contacts write API is used anywhere (`CNSaveRequest` absent) |
| Duplicates by normalized phone/email; merge only after review; undo in session | Passed (logic) | `phoneNormalization`, `similarNamesWithDifferentNumbersAreNotDuplicates`, `mergePreservesEvidenceAndRemindersAndCanBeUndone`, `mergeCanBeUndoneWithinTheSession` |

## FR2 Memory and evidence

| Criterion | Status | Evidence |
|---|---|---|
| Every extracted fact links to its source | Passed (logic) | `memoryCaptureProposesGroundedItemsAndConfirmsWithProvenance`, `autoSaveOnlyForExplicitNonSensitiveResolvedItems` (`hasRequiredProvenance`) |
| Conflicting dates appear for review | Passed (logic): a second, different birthday/anniversary marks both disputed; no reminders until one is kept | `DateConflictTests/conflictingBirthdaysGoToReviewAndStopReminders` |
| Deleting source triggers review or removal of dependent facts and suggestions | Passed (logic) | `deletingSourceRemovesUnconfirmedDerivedDetailsAndInvalidatesCardsAndDrafts`, `deletingSourceCanKeepConfirmedDetailsWithoutExcerpt` |
| No deleted text remains in search indexes or generated briefs | Passed (logic) | `searchIsLocalAndForgetsDeletedText`, `briefUsesOnlyConfirmedNonSensitiveInformation`; no separate index exists |

## FR3 Important dates

| Criterion | Status | Evidence |
|---|---|---|
| Year boundaries | Passed (logic) | `dayArithmeticCrossesYearBoundary`, `nextOccurrenceAcrossYearBoundary`, `yearBoundaryAndMissedExecution` |
| Time-zone changes | Passed (logic) | `calendarDayFollowsTimeZone`, `birthdayDayFollowsCurrentTimeZone`, `dateRemindersFloatWithTimeZoneWhileSnoozesStayAbsolute` |
| Daylight saving | Passed (logic) | `wallClockTimesAcrossDaylightSavingEnd`, `wallClockTimeInSpringForwardGapStillResolves` |
| Absent birth year (no age) | Passed (logic) | `ageOnlyWithBirthYear`, `ageOnlyAppearsWithBirthYear` |
| Leap day: user chooses Feb 28 / Mar 1 | Passed (logic) | `leapDayRequiresExplicitChoice`, `leapDayWithoutChoiceProducesNoGuess`; UI requires a choice before saving |
| Missed device execution | Passed (logic) | `yearBoundaryAndMissedExecution` (card still shown the day after) |
| Completing this year's birthday keeps next year's | Passed (logic) | `completingOneOccurrenceKeepsFutureOnes`, `completingThisYearsBirthdayKeepsNextYears` |
| Defaults 14 days + day-of; sensitive dates private, never celebratory | Passed (logic) | `carefulDatesDefaultToPrivateAndOff`, `carefulDatesAreNeverCelebratory`, `birthdayGetsPlanningAndDayOfReminders` |

## FR4 Promises

| Criterion | Status | Evidence |
|---|---|---|
| Completing/cancelling removes cards and pending notifications | Passed (logic) | `completingPromiseRemovesItsNotificationAndEditingReschedules`; `setPromiseStatus` resolves related card records |
| Editing due date reschedules | Passed (logic) | same test (new identifier, old removed) |
| Extraction cannot invent a commitment | Passed (logic) | `modelCannotInventACommitment`, `promptInjectionInNotesProducesNoAuthority` |
| Undated promise never becomes overdue | Passed (logic) | `undatedPromiseNeverOverdue`, `pinnedItemsStayVisibleAndUndatedPromisesStayQuiet` |

## FR5 Interactions and rhythm

| Criterion | Status | Evidence |
|---|---|---|
| "We caught up yesterday" updates timeline and suppresses cadence | Passed (logic) | `cadenceUsesOnlyRealInteractionsAndAsksForBaseline` |
| A draft does not count as contact | Passed (logic) | same test (handed-off draft) |
| No statement that a friendship is deteriorating | Passed (logic) | Card copy is fixed text; `regularThenQuietProducesHonestCard` asserts wording |
| No history → ask for a baseline | Passed (logic) | same cadence test (`cadence.baseline` card) |

## FR6 Calendar

| Criterion | Status | Evidence |
|---|---|---|
| Cancelled or moved events update on refresh | Passed (logic) | `movedCancelledAndMissingEventsUpdateOnRefresh`, `calendarRefreshHonorsDeniedAccessAndUpdatesMovedEvents` |
| Denied/revoked → honest unavailable state | Passed (logic); device not tested | `deniedPermissionIsShownHonestly`, `.accessUnavailable` path |
| Recurring meetings do not duplicate cards | Passed (logic) | `meetingsBriefBeforeAndAskAfterWithoutDuplicates` |
| Attendance confirmed before logging | Passed (logic) | `onlyConfirmedAttendanceCreatesInteraction` |
| Only needed fields stored; titles optional | Passed (logic) | `titlesAreNotCachedWhenUserOptsOut` |
| Background refresh best effort with last-refreshed time | Partially: refresh on activation; no BGTask scheduled; last refresh stored | `CalendarLink.lastRefreshedAt` |

## FR7 Suggestion rules

| Criterion | Status | Evidence |
|---|---|---|
| Same input and clock → same cards | Passed (logic) | `sameInputAndClockProduceSameCards` |
| Paused people generate none | Passed (logic) | `pausedPeopleGenerateNothing`, `pausingAPersonSilencesCardsAndNotifications` |
| Future or deleted evidence cannot generate cards | Passed (logic) | `futureEvidenceCannotGenerateCards`, `deletedEvidenceInvalidatesRecord` |
| Explains itself without a model | Passed (logic) | `everyCardExplainsItselfWithoutAModel` |
| Dismissed occurrence does not reappear on restart | Passed (logic) | `dismissedOccurrenceDoesNotReturn`, `dismissedCardsStayDismissedAcrossRestart` |
| Snooze survives time changes without firing twice | Passed (logic) | `snoozeIsAbsoluteAndSurvivesTimeZoneChange` |
| ≤1 unsolicited card per person per day; pinned exempt | Passed (logic) | `atMostOneUnsolicitedCardPerPersonPerDay`, `pinnedItemsStayVisibleAndUndatedPromisesStayQuiet` |
| Card limit configurable; suggestions can be disabled | Passed (logic) | `suggestionsCanBeDisabledAndLimitChanged` |

## FR8 Draft and send

| Criterion | Status | Evidence |
|---|---|---|
| Cancel leaves no completed interaction | Passed (logic) | `draftCancelAndSendOutcomesAreRecordedPrecisely` |
| Changed recipient visible before sending | Passed (logic) for policy; UI shows recipient picker (device not tested) | `approvalIsBoundToExactRecipientAndText`, `wrongRecipientAddressIsCaught` |
| Deleted source invalidates unsent cached draft | Passed (logic) | `deletingSourceRemovesUnconfirmedDerivedDetailsAndInvalidatesCardsAndDrafts` |
| Copy only after explicit action | Passed by construction | Clipboard written only in the "Copy text" button handler |
| Never invent memories/feelings; sensitive only when selected | Passed (logic) | `templatesNeverInventMemoriesOrFeelings`, `onlyConfirmedAndExplicitlyAllowedSensitiveContextIsUsed`, `personalizationGuardRejectsInventedContent` |
| System "sent" recorded precisely; never claims delivery | Passed (logic) | `draftCancelAndSendOutcomesAreRecordedPrecisely`, `outcomesAreNeverUpgraded` |
| Message composer handoff on device | Not tested (device) | `MessageComposer` |

## FR9 Gifts

| Criterion | Status | Evidence |
|---|---|---|
| No raw card or CVV field | Passed | `scripts/privacy-guards.sh` |
| Gift idea works offline | Passed (logic) | Stored in the vault like any record |
| Purchase never inferred from opening a link | Passed (logic) | `GiftActions.urlToOpen` has no side effects; state changes only via explicit "Mark as" |
| URLs pass no private notes | Passed (logic) | `giftLinksAndSearchesLeakNothingPrivate` |
| Future in-app checkout requirements (totals, states, no duplicate orders) | Not built (policy pieces tested: totals, currency, approval binding) | `purchasesNeedTransactionSpecificApproval` |

## FR10 Local notifications

| Criterion | Status | Evidence |
|---|---|---|
| Permission denial does not break Today | Passed (logic) | `deniedPermissionSchedulesNothingAndClearsOurs`; Today is independent of notifications |
| Duplicate scheduling is idempotent | Passed (logic) | `planningIsIdempotentAndReconcileConverges` |
| Archived/deleted people have no pending notifications | Passed (logic) | `pausedArchivedAndDeletedPeopleHaveNoPendingNotifications`, `deletingAPersonRemovesTheirDataAndNotifications` |
| Sensitive text never appears under private setting | Passed (logic) | `genericByDefaultWithOpaqueIdentifiers`, `detailedOptInNeverRevealsSensitiveItems` |
| Quiet hours; bounded window | Passed (logic) | `quietHoursAreRespected`, `windowIsBounded` |
| Delivery on device | Not tested (device) | `UserNotificationScheduler` |

## FR11 Export, restore, deletion

| Criterion | Status | Evidence |
|---|---|---|
| Round-trip all supported records | Passed (logic) | `exportAndRestoreRoundTripOnANewDevice`, `backupRestoreRoundTripsToANewDevice` |
| Tampering detected | Passed (logic) | `tamperingIsDetected` |
| Cancelled/failed restore preserves data | Passed (logic) | `failedRestoreLeavesCurrentVaultUntouched` (cancel = no call) |
| Wrong secret / newer schema / interrupted write | Passed (logic) | `wrongRecoveryKeyIsRejected`, `newerSchemaIsRefused`, `interruptedWritesNeverLeavePartialArchives` |
| Device key never exported | Passed (logic) | `archiveNeverContainsPlaintextOrTheDeviceKey` |
| Delete all → onboarding with no recoverable key | Passed (logic); Keychain deletion on device not tested | `deleteEverythingReturnsToOnboardingWithNoRecoverableKey` |
| Delete person previews dependents and resolves shared notes | Passed (logic) | `deletingPersonDetachesSharedNotesAndVoidsRuleApproval`, `deletingPersonCanDeleteSharedNotes` |

## FR12 Source connections

| Criterion | Status | Evidence |
|---|---|---|
| Full capability matrix with status, evidence, dates, next experiments | Passed | `docs/integrations/capability-matrix.md` (44 routes, checked 2026-11-02) and bundled catalog test |
| Every enabled connector proves access on a test account | Not tested — no account-based connector is built | — |
| Disconnected connectors transmit nothing | Passed by construction (no networking in core; guard) | `scripts/privacy-guards.sh` |
| Duplicate imports add no duplicate interaction | Passed (logic) | `whatsAppImportFeedsRhythmAndIsIdempotent`, `linkedInStoresOnlyMappedRowsAndDetectsRoleChanges` |
| Shared content stays local during parsing | Passed (logic) | Parsers are pure functions; share inbox is HPKE-sealed (`sealedItemsOpenOnlyWithTheAppKey`) |
| Unsupported sources show honest text, never a fake Connect | Passed (logic) | `unsupportedSourcesNeverOfferAFakeConnect` |
| Import preview: format, people, range, duplicates, storage | Passed (logic) | `ImportPreview` fields asserted in capture tests |
| Revocation stops capture and offers deletion | Passed (logic) | `revokingAnImportStopsCaptureAndCanDeleteCopies` |
| P0: text-share capture | Passed (logic); extension not run on device | `textShareIsCapturedOnceAndIdempotent`, `shareInboxItemsAreSealedDrainedOnceAndDeleted` |
| Automatic cross-app monitoring | **Not delivered** (not claimed) | Matrix: no supported route for messaging apps |

## FR13 Life updates and interests

| Criterion | Status | Evidence |
|---|---|---|
| Old announcements don't become new-job alerts | Passed (logic) | `lifeUpdatesNeedRecentExplicitConfirmedDatedEvents`, `repostsOldNewsAndAspirationsAreNotCurrentEvents` |
| Conflicting accounts require review | Partially: all source-derived updates are unconfirmed until reviewed; explicit conflict detection not built | Review queue |
| Source timestamps visible | Passed (UI build) | Review shows excerpt; "Why this appeared" shows dated source |
| Incorrect identity suppresses action | Passed (logic) | `ambiguousIdentityIsNotGuessed`; unresolved items cannot be saved without choosing |
| One event across sources → one card | Passed (logic) | dedupe in `lifeUpdatesNeedRecentExplicitConfirmedDatedEvents` |
| Missing dates not invented | Passed (logic) | `linkedInStoresOnlyMappedRowsAndDetectsRoleChanges` (`eventDay == nil`) |
| Weak signals not confident preferences | Passed (logic) | weak-signal event produces no card |

## FR14 Relationship rhythm

| Criterion | Status | Evidence |
|---|---|---|
| Inadequate coverage → no claim | Passed (logic) | `tooFewActiveDaysMakesNoClaim`, `coverageGapBlocksClaimsAfterReconnect` |
| Reconnecting doesn't trigger stale alerts before refresh | Passed (logic) | `coverageGapBlocksClaimsAfterReconnect`, `staleOrDisconnectedSourcePausesRule` |
| Explicit pause suppresses all cadence prompts | Passed (logic) | `pauseAndOptOutSuppressEverything` |
| Lull not labelled decline; coverage shown | Passed (logic) | `regularThenQuietProducesHonestCard` |
| Group/business messages excluded | Passed (logic) | `groupAndBusinessMessagesDoNotCount` |

## FR15 Contextual planning

| Criterion | Status | Evidence |
|---|---|---|
| Planned meeting ≠ attended meeting | Passed (logic) | `onlyConfirmedAttendanceCreatesInteraction` |
| Trips current or marked uncertain | Passed (logic) | `travelOverlapUsesUserEnteredCitiesAndFlagsUncertainty`, `uncertainTravelIsWordedAsUncertain` |
| No duplicate gift suggestion for given item | Passed (logic) | `RuleSet.giftIdeas` excludes given identities (covered indirectly; no dedicated test) |
| No automatic address disclosure to gift search | Passed (logic) | `giftLinksAndSearchesLeakNothingPrivate` |
| Introductions / shared-activity suggestions | Not built | — |

## FR16 Message automation

| Criterion | Status | Evidence |
|---|---|---|
| Rule disabled before execution sends nothing | Passed (logic) | `disabledOrPausedRulesSendNothing` |
| Duplicate triggers → one submission | Passed (logic) | `fullyValidRuleOnVerifiedChannelExecutesOnce`, `idempotencyKeysAreUniqueAtStorageLevel` |
| Unavailable unattended-send APIs fall back to review | Passed (logic) | `unverifiedChannelsFallBackToReview` |
| AI cannot modify allowlist or approve itself | Passed (logic) | `changingScopeRequiresRenewedApproval`, `modelSuggestionsNeverAuthorizeThemselves` |
| Prompt injection cannot send | Passed (logic) | `promptInjectionInNotesProducesNoAuthority`, `recipientsOutsideAllowlistAndOffTemplateTextNeedReview` |
| Ambiguous result never becomes claimed delivery | Passed (logic) | `outcomesAreNeverUpgraded` |
| Missed windows expire | Passed (logic) | `missedWindowsExpireInsteadOfSurpriseSends` |
| Rule creation/preview UI | Not built (policy and storage only) | — |

## Section 7 (local intelligence), 10 (privacy gate), 11 (quality)

| Criterion | Status | Evidence |
|---|---|---|
| On-device model only after runtime checks; no cloud fallback | Passed (build); device not tested | `FoundationModelsExtractor.availability`, privacy guard |
| Output validated against evidence; missing dates stay missing | Passed (logic) | `ExtractionTests` suite |
| Voice only when on-device transcription is guaranteed; raw audio deleted | Implemented; not tested (device) | `OnDeviceTranscriber` |
| Privacy beta gate items | See `docs/privacy.md` — device items not done | — |
| Synthetic fixtures; demo labelled, never mixed | Passed (logic) | `SyntheticFixtures`, `noPasscodeBlocksRealDataButDemoWorksSeparately` |
| UI tests listed in PRD §11 | Passed (simulator) except as noted: onboarding without permission, add person/date/promise → card, review draft → cancel, pause person, demo labelled and exits, backup starts with a recovery key, delete everything → onboarding — all 7 passed in CI run 6. Export → restore through the document picker is not UI-tested (covered by `backupRestoreRoundTripsToANewDevice`) | `App/LittleThingsUITests`, CI job "Package tests (macOS) and iOS app build" |
| Accessibility (Dynamic Type, VoiceOver, reduced motion) | Implemented with system controls and labels; **not audited** | — |
| Performance targets (1,000 people / 20,000 notes) | Measured on a Linux x86 container (release build), **not the reference iPhone**: open + decrypt + load 22,000 records 0.33 s; engine pass 11 ms; search corpus build 0.17 s, then search p95 129 ms (first attempt was 449 ms and was fixed). Device measurement still required | `LT_PERF=1 swift test -c release -Xswiftc -enable-testing --filter PerformanceTests` |
| Physical-device verification list | **Not done** | `docs/handoff.md` |
