import Foundation

// MARK: - Suggestions (FR7)

public enum SuggestionRuleID: String, Codable, Sendable, CaseIterable {
    case dateUpcoming = "date.upcoming"
    case promiseDue = "promise.due"
    case followUpDue = "followup.due"
    case pinnedPromise = "promise.pinned"
    case meetingBrief = "meeting.brief"
    case meetingFollowUp = "meeting.followup"
    case cadenceCheck = "cadence.check"
    case cadenceBaseline = "cadence.baseline"
    case rhythmLull = "rhythm.lull"
    case lifeUpdate = "life.update"
    case travelOverlap = "travel.overlap"
}

public enum SuggestionState: String, Codable, Sendable, CaseIterable {
    case proposed
    case visible
    case snoozed
    /// Dismissed for this occurrence only.
    case dismissed
    case completed
    /// The supporting evidence changed or disappeared.
    case invalidated

    /// Terminal states never reappear for the same occurrence.
    public var isTerminal: Bool {
        self == .dismissed || self == .completed || self == .invalidated
    }
}

/// Persisted state of a card occurrence. Identity is the occurrence key, so a dismissed
/// occurrence stays dismissed across restarts.
public struct SuggestionRecord: Identifiable, Hashable, Codable, Sendable {
    public var id: SuggestionID
    public var occurrenceKey: String
    public var ruleID: SuggestionRuleID
    public var personID: PersonID
    public var evidence: [EvidenceRef]
    public var reason: String
    public var scheduledFor: Date
    public var state: SuggestionState
    /// Absolute instant; immune to time-zone changes.
    public var snoozedUntil: Date?
    public var isPinned: Bool
    /// When the card was first shown (used for the per-person daily limit).
    public var firstShownAt: Date?
    public var updatedAt: Date

    public init(
        id: SuggestionID = SuggestionID(),
        occurrenceKey: String,
        ruleID: SuggestionRuleID,
        personID: PersonID,
        evidence: [EvidenceRef],
        reason: String,
        scheduledFor: Date,
        state: SuggestionState,
        snoozedUntil: Date? = nil,
        isPinned: Bool = false,
        firstShownAt: Date? = nil,
        updatedAt: Date
    ) {
        self.id = id
        self.occurrenceKey = occurrenceKey
        self.ruleID = ruleID
        self.personID = personID
        self.evidence = evidence
        self.reason = reason
        self.scheduledFor = scheduledFor
        self.state = state
        self.snoozedUntil = snoozedUntil
        self.isPinned = isPinned
        self.firstShownAt = firstShownAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Drafts (FR8)

public enum DraftTone: String, Codable, Sendable, CaseIterable {
    case simple
    case warm
    case playful
    case professional
}

public enum MessageChannel: String, Codable, Sendable, CaseIterable {
    case sms
    case iMessage
    case email
    case whatsApp
    case shareSheet
    case clipboard
}

public struct DraftRecipient: Hashable, Codable, Sendable {
    public var personID: PersonID
    public var channel: MessageChannel
    /// Phone number or email address shown to the user before handoff.
    public var address: String?

    public init(personID: PersonID, channel: MessageChannel, address: String?) {
        self.personID = personID
        self.channel = channel
        self.address = address
    }
}

public enum DraftOutcome: String, Codable, Sendable {
    case editing
    /// Given to the system composer or share sheet. Not a claim of delivery.
    case handedOff
    /// The system composer reported "sent" (MessageUI `.sent`). Still not "delivered".
    case systemReportedSent
    /// The user told us they sent it.
    case userConfirmedSent
    case userReportedNotSent
    case cancelled
    case failed
    /// Supporting evidence was deleted before sending.
    case invalidated

    public var countsAsInteraction: Bool {
        self == .systemReportedSent || self == .userConfirmedSent
    }
}

public struct Draft: Identifiable, Hashable, Codable, Sendable {
    public var id: DraftID
    public var personID: PersonID
    public var suggestionKey: String?
    /// Only the evidence the user selected for this draft.
    public var evidence: [EvidenceRef]
    public var text: String
    public var tone: DraftTone
    public var recipient: DraftRecipient?
    public var outcome: DraftOutcome
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: DraftID = DraftID(),
        personID: PersonID,
        suggestionKey: String? = nil,
        evidence: [EvidenceRef] = [],
        text: String,
        tone: DraftTone = .simple,
        recipient: DraftRecipient? = nil,
        outcome: DraftOutcome = .editing,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.personID = personID
        self.suggestionKey = suggestionKey
        self.evidence = evidence
        self.text = text
        self.tone = tone
        self.recipient = recipient
        self.outcome = outcome
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    public var isUnsent: Bool {
        outcome == .editing || outcome == .handedOff
    }
}

// MARK: - Preferences

public enum NotificationPrivacy: String, Codable, Sendable {
    /// "You have a relationship reminder." (default)
    case generic
    /// Names and details on the lock screen. Requires explicit opt-in. Sensitive items stay generic.
    case detailed
}

/// Configurable parameters for the FR14 rhythm hypothesis. Not scientific metrics.
public struct RhythmParameters: Hashable, Codable, Sendable {
    public var baselineWeeks: Int
    public var minimumActiveDays: Int
    public var lullDays: Int
    /// Maximum age of the last successful refresh for a source to count as current.
    public var maximumStalenessHours: Int

    public init(baselineWeeks: Int = 8, minimumActiveDays: Int = 8, lullDays: Int = 21, maximumStalenessHours: Int = 72) {
        self.baselineWeeks = baselineWeeks
        self.minimumActiveDays = minimumActiveDays
        self.lullDays = lullDays
        self.maximumStalenessHours = maximumStalenessHours
    }
}

public struct Preferences: Hashable, Codable, Sendable {
    public var onboardingCompleted: Bool
    public var suggestionsEnabled: Bool
    public var dailyCardLimit: Int
    public var maxUnsolicitedCardsPerPersonPerDay: Int
    public var quietHours: QuietHours
    public var notificationPrivacy: NotificationPrivacy
    public var digestTime: TimeOfDay
    public var maxDigestsPerDay: Int
    /// Re-authenticate after this many seconds in the background.
    public var appLockTimeoutSeconds: Int
    /// nil = follow the device time zone.
    public var fixedTimeZoneIdentifier: String?
    /// Source kinds/providers for which explicit, non-sensitive details may be auto-saved
    /// (still labelled source-derived).
    public var autoSaveProviders: Set<String>
    public var rhythm: RhythmParameters
    public var notificationPermissionRequested: Bool
    public var backupPromptShown: Bool
    public var lastBackupAt: Date?
    /// Whether the user allows caching calendar event titles.
    public var cacheCalendarTitles: Bool

    public init(
        onboardingCompleted: Bool = false,
        suggestionsEnabled: Bool = true,
        dailyCardLimit: Int = 3,
        maxUnsolicitedCardsPerPersonPerDay: Int = 1,
        quietHours: QuietHours = QuietHours(),
        notificationPrivacy: NotificationPrivacy = .generic,
        digestTime: TimeOfDay = .morning,
        maxDigestsPerDay: Int = 1,
        appLockTimeoutSeconds: Int = 60,
        fixedTimeZoneIdentifier: String? = nil,
        autoSaveProviders: Set<String> = [],
        rhythm: RhythmParameters = RhythmParameters(),
        notificationPermissionRequested: Bool = false,
        backupPromptShown: Bool = false,
        lastBackupAt: Date? = nil,
        cacheCalendarTitles: Bool = true
    ) {
        self.onboardingCompleted = onboardingCompleted
        self.suggestionsEnabled = suggestionsEnabled
        self.dailyCardLimit = dailyCardLimit
        self.maxUnsolicitedCardsPerPersonPerDay = maxUnsolicitedCardsPerPersonPerDay
        self.quietHours = quietHours
        self.notificationPrivacy = notificationPrivacy
        self.digestTime = digestTime
        self.maxDigestsPerDay = maxDigestsPerDay
        self.appLockTimeoutSeconds = appLockTimeoutSeconds
        self.fixedTimeZoneIdentifier = fixedTimeZoneIdentifier
        self.autoSaveProviders = autoSaveProviders
        self.rhythm = rhythm
        self.notificationPermissionRequested = notificationPermissionRequested
        self.backupPromptShown = backupPromptShown
        self.lastBackupAt = lastBackupAt
        self.cacheCalendarTitles = cacheCalendarTitles
    }
}

// MARK: - Connections and capture (FR12)

public enum ConnectionState: Hashable, Codable, Sendable {
    case connected
    /// Login expired: show a clear Reconnect action rather than silently stale data.
    case needsReconnect
    case disconnected
    case revoked
    case failed(reason: String)

    public var isActive: Bool { self == .connected }
}

/// A period during which a source was connected and refreshed, optionally scoped to
/// specific people (for example a single exported chat).
public struct CoverageInterval: Hashable, Codable, Sendable {
    public var start: Date
    public var end: Date
    public var personIDs: [PersonID]?

    public init(start: Date, end: Date, personIDs: [PersonID]? = nil) {
        self.start = start
        self.end = end
        self.personIDs = personIDs
    }

    public func covers(personID: PersonID) -> Bool {
        personIDs?.contains(personID) ?? true
    }
}

public struct Connection: Identifiable, Hashable, Codable, Sendable {
    public var id: ConnectionID
    /// Capability-catalog identifier, e.g. "whatsapp-chat-export".
    public var provider: String
    public var displayName: String
    public var scopeDescription: String
    /// Name of the device-only Keychain item holding a token, if any. Never the token itself.
    public var tokenKeychainReference: String?
    public var coverage: [CoverageInterval]
    public var lastSuccessfulRefresh: Date?
    public var state: ConnectionState
    /// Whether this source is a one-off user import rather than an ongoing connector.
    public var isManualImport: Bool
    public var createdAt: Date

    public init(
        id: ConnectionID = ConnectionID(),
        provider: String,
        displayName: String,
        scopeDescription: String,
        tokenKeychainReference: String? = nil,
        coverage: [CoverageInterval] = [],
        lastSuccessfulRefresh: Date? = nil,
        state: ConnectionState = .connected,
        isManualImport: Bool,
        createdAt: Date
    ) {
        self.id = id
        self.provider = provider
        self.displayName = displayName
        self.scopeDescription = scopeDescription
        self.tokenKeychainReference = tokenKeychainReference
        self.coverage = coverage
        self.lastSuccessfulRefresh = lastSuccessfulRefresh
        self.state = state
        self.isManualImport = isManualImport
        self.createdAt = createdAt
    }
}

public enum ExtractionState: String, Codable, Sendable {
    case pending
    case reviewed
    case autoSaved
    case skipped
}

/// One captured provider record. Unique per (provider, fingerprint) so retries are idempotent.
public struct CaptureRecord: Identifiable, Hashable, Codable, Sendable {
    public var id: CaptureRecordID
    public var provider: String
    public var providerRecordID: String?
    public var fingerprint: String
    public var sourceID: SourceID?
    public var interactionID: InteractionID?
    public var personIDs: [PersonID]
    public var importBatchID: ImportBatchID?
    public var extractionState: ExtractionState
    public var capturedAt: Date

    public init(
        id: CaptureRecordID = CaptureRecordID(),
        provider: String,
        providerRecordID: String? = nil,
        fingerprint: String,
        sourceID: SourceID? = nil,
        interactionID: InteractionID? = nil,
        personIDs: [PersonID] = [],
        importBatchID: ImportBatchID? = nil,
        extractionState: ExtractionState = .pending,
        capturedAt: Date
    ) {
        self.id = id
        self.provider = provider
        self.providerRecordID = providerRecordID
        self.fingerprint = fingerprint
        self.sourceID = sourceID
        self.interactionID = interactionID
        self.personIDs = personIDs
        self.importBatchID = importBatchID
        self.extractionState = extractionState
        self.capturedAt = capturedAt
    }
}

// MARK: - Automation (FR16)

public enum AutomationTrigger: Hashable, Codable, Sendable {
    /// On the day of a confirmed annual date of this category (never `.careful`).
    case annualDate(DateCategory)
    /// After the user marks a linked meeting as attended.
    case meetingMarkedAttended
}

public struct RuleRecipient: Hashable, Codable, Sendable {
    public var personID: PersonID
    public var address: String

    public init(personID: PersonID, address: String) {
        self.personID = personID
        self.address = address
    }
}

public struct FrequencyLimit: Hashable, Codable, Sendable {
    public var maxSends: Int
    public var perDays: Int

    public init(maxSends: Int, perDays: Int) {
        self.maxSends = maxSends
        self.perDays = perDays
    }
}

/// The user's approval of a rule's exact scope. Any change to recipients, channel, trigger,
/// template or permitted context changes the scope digest and voids the approval.
public struct RuleApproval: Hashable, Codable, Sendable {
    public var approvedAt: Date
    public var scopeDigest: String
    /// The example output the user saw before activation.
    public var previewedExample: String

    public init(approvedAt: Date, scopeDigest: String, previewedExample: String) {
        self.approvedAt = approvedAt
        self.scopeDigest = scopeDigest
        self.previewedExample = previewedExample
    }
}

public struct AutomationRule: Identifiable, Hashable, Codable, Sendable {
    public var id: AutomationRuleID
    public var name: String
    public var recipients: [RuleRecipient]
    public var channel: MessageChannel
    public var trigger: AutomationTrigger
    /// Approved template. Placeholders: {name}.
    public var template: String
    public var allowsBoundedPersonalization: Bool
    public var permittedContext: Set<FactCategory>
    public var windowStart: TimeOfDay
    public var windowEnd: TimeOfDay
    public var expiresAt: Date
    public var frequencyLimit: FrequencyLimit
    public var isPaused: Bool
    public var approval: RuleApproval?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: AutomationRuleID = AutomationRuleID(),
        name: String,
        recipients: [RuleRecipient],
        channel: MessageChannel,
        trigger: AutomationTrigger,
        template: String,
        allowsBoundedPersonalization: Bool = false,
        permittedContext: Set<FactCategory> = [],
        windowStart: TimeOfDay = TimeOfDay(hour: 9),
        windowEnd: TimeOfDay = TimeOfDay(hour: 20),
        expiresAt: Date,
        frequencyLimit: FrequencyLimit = FrequencyLimit(maxSends: 1, perDays: 300),
        isPaused: Bool = false,
        approval: RuleApproval? = nil,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.recipients = recipients
        self.channel = channel
        self.trigger = trigger
        self.template = template
        self.allowsBoundedPersonalization = allowsBoundedPersonalization
        self.permittedContext = permittedContext
        self.windowStart = windowStart
        self.windowEnd = windowEnd
        self.expiresAt = expiresAt
        self.frequencyLimit = frequencyLimit
        self.isPaused = isPaused
        self.approval = approval
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }
}

public enum ActionKind: String, Codable, Sendable {
    case sendMessage
    case purchase
    case shareDetails
    case introduction
}

public enum ActionAttemptStatus: String, Codable, Sendable {
    case awaitingReview
    case submitted
    case sent
    /// Only when the channel actually reports delivery.
    case delivered
    case failed
    case cancelled
    /// Outcome cannot be determined; never retried blindly.
    case unknown
    /// The execution window passed (for example after a long offline period).
    case expired
}

public struct ActionAttempt: Identifiable, Hashable, Codable, Sendable {
    public var id: ActionAttemptID
    public var kind: ActionKind
    public var ruleID: AutomationRuleID?
    public var approvalDigest: String?
    public var idempotencyKey: String
    public var recipientPersonID: PersonID?
    public var recipientAddress: String?
    public var channel: MessageChannel?
    /// Hash of the exact payload; the payload itself stays in the draft.
    public var payloadDigest: String
    public var status: ActionAttemptStatus
    public var providerStatus: String?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: ActionAttemptID = ActionAttemptID(),
        kind: ActionKind,
        ruleID: AutomationRuleID? = nil,
        approvalDigest: String? = nil,
        idempotencyKey: String,
        recipientPersonID: PersonID? = nil,
        recipientAddress: String? = nil,
        channel: MessageChannel? = nil,
        payloadDigest: String,
        status: ActionAttemptStatus,
        providerStatus: String? = nil,
        createdAt: Date,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.kind = kind
        self.ruleID = ruleID
        self.approvalDigest = approvalDigest
        self.idempotencyKey = idempotencyKey
        self.recipientPersonID = recipientPersonID
        self.recipientAddress = recipientAddress
        self.channel = channel
        self.payloadDigest = payloadDigest
        self.status = status
        self.providerStatus = providerStatus
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }
}
