import Foundation
import LTCapture
import LTCryptoSupport
import LTDomain
import LTIntegrations
import LTIntelligence
import LTPolicy
import LTSuggestions
import LTVault

/// Result of capturing a memory: the saved original note plus grounded proposals for review.
public struct MemoryCapture: Sendable {
    public var source: Source
    public var proposal: ExtractionProposal
    /// Whether the on-device model produced the proposals (otherwise pattern suggestions).
    public var usedLocalModel: Bool
    /// Items saved automatically under the source's auto-save setting (unconfirmed).
    public var autoSavedCount: Int
}

/// The user's choices on the review screen.
public struct ProposalSelection: Sendable {
    public var facts: [(ProposedFact, PersonID)] = []
    public var dates: [(ProposedDate, PersonID, LeapDayPolicy?)] = []
    public var promises: [(ProposedPromise, [PersonID])] = []
    public var lifeEvents: [(ProposedLifeEvent, PersonID)] = []

    public init() {}
}

extension AppModel {
    var now: Date { env.clock.now }

    // MARK: People (FR1)

    @discardableResult
    public func addPerson(_ person: Person) async throws -> Person {
        var p = person
        p.isDemo = isDemo
        try await commit([.upsert(.person(p))])
        return p
    }

    public func updatePerson(_ person: Person) async throws {
        var p = person
        p.updatedAt = now
        try await commit([.upsert(.person(p))])
    }

    public func setPaused(_ personID: PersonID, _ paused: Bool) async throws {
        guard var person = snapshot.people[personID] else { throw AppError.personNotFound }
        person.reminderPreferences.isPaused = paused
        try await updatePerson(person)
    }

    public func setArchived(_ personID: PersonID, _ archived: Bool) async throws {
        guard var person = snapshot.people[personID] else { throw AppError.personNotFound }
        person.isArchived = archived
        try await updatePerson(person)
    }

    public func deletionPreview(for personID: PersonID, sharedSources: SharedSourceResolution = .detach) -> PersonDeletionPlan {
        DeletionPlanner.planPersonDeletion(personID, in: snapshot, sharedSources: sharedSources, now: now)
    }

    /// Deletes only LittleThings' copy. The system address book is never modified.
    public func deletePerson(_ plan: PersonDeletionPlan) async throws {
        try await commit(plan.changes)
    }

    /// Imports contacts the user picked. Birthdays from contact cards are offered for review.
    @discardableResult
    public func importContacts(_ contacts: [ImportedContact]) async throws -> [PersonID] {
        var changes: [RecordChange] = []
        var ids: [PersonID] = []
        for contact in contacts {
            if snapshot.people.values.contains(where: { $0.contactReference?.identifier == contact.identifier }) { continue }
            let plan = ContactImportPlanner.plan(for: contact, now: now, isDemo: isDemo)
            ids.append(plan.person.id)
            changes.append(.upsert(.person(plan.person)))
            changes.append(.upsert(.source(plan.source)))
            if let birthday = plan.birthdayCandidate { changes.append(.upsert(.importantDate(birthday))) }
        }
        try await commit(changes)
        return ids
    }

    public var duplicateCandidates: [DuplicateCandidate] {
        DuplicateDetector.candidates(in: Array(snapshot.people.values))
    }

    public func merge(keep: PersonID, absorb: PersonID) async throws {
        guard let plan = MergePlanner.planMerge(keep: keep, absorb: absorb, in: snapshot, now: now) else { throw AppError.personNotFound }
        try await commit(plan.changes)
        mergeUndoStack.append(plan)
    }

    public var canUndoMerge: Bool { !mergeUndoStack.isEmpty }

    public func undoLastMerge() async throws {
        guard let plan = mergeUndoStack.popLast() else { throw AppError.nothingToUndo }
        try await commit(plan.undoChanges)
    }

    // MARK: Memories and review (FR2, PRD section 7)

    /// Saves the original note, then proposes grounded details for review. Uses the on-device
    /// model when available, otherwise deterministic pattern suggestions. Never a cloud model.
    public func addMemory(_ text: String, people personIDs: [PersonID], kind: SourceKind = .manualNote, sensitivity: Sensitivity = .normal, eventDay: CalendarDay? = nil) async throws -> MemoryCapture {
        let source = Source(kind: kind, capturedAt: now, eventDay: eventDay, text: text, sensitivity: sensitivity, personIDs: personIDs, isDemo: isDemo)
        try await commit([.upsert(.source(source))])
        return try await propose(for: source)
    }

    func propose(for source: Source) async throws -> MemoryCapture {
        let hints = source.personIDs.compactMap { snapshot.people[$0] }.map(PersonHint.init(person:))
        let captureDay = CalendarDay(date: source.capturedAt, timeZone: context.timeZone)
        var raw: RawExtraction
        var usedModel = false
        if let model = env.localModel, model.availability().isAvailable {
            do {
                raw = try await model.extract(ExtractionRequest(sourceText: source.text, captureDay: captureDay, people: hints))
                usedModel = true
            } catch {
                raw = PatternExtractor().extract(from: source.text, people: hints, captureDay: captureDay)
            }
        } else {
            raw = PatternExtractor().extract(from: source.text, people: hints, captureDay: captureDay)
        }
        let proposal = ExtractionValidator().validate(raw, source: source, people: hints, captureDay: captureDay)

        // Optional scoped auto-save: explicit, non-sensitive facts/dates, saved unconfirmed.
        var autoSaved = 0
        if snapshot.preferences.autoSaveProviders.contains(source.provider ?? source.kind.rawValue) {
            var changes: [RecordChange] = []
            for fact in proposal.facts where AutoSavePolicy.canAutoSave(fact) {
                changes.append(.upsert(.fact(ProposalMaterializer.fact(fact, personID: fact.identity.personID!, source: source, confirmed: false, autoSaved: true, now: now))))
            }
            for date in proposal.dates where AutoSavePolicy.canAutoSave(date) {
                changes.append(.upsert(.importantDate(ProposalMaterializer.date(date, personID: date.identity.personID!, source: source, confirmed: false, now: now))))
            }
            autoSaved = changes.count
            if !changes.isEmpty { try await commit(changes) }
        }
        return MemoryCapture(source: source, proposal: proposal, usedLocalModel: usedModel, autoSavedCount: autoSaved)
    }

    /// Saves the items the user confirmed. Each keeps its source and excerpt.
    public func confirm(_ selection: ProposalSelection, from source: Source) async throws {
        var changes: [RecordChange] = []
        for (fact, person) in selection.facts {
            changes.append(.upsert(.fact(ProposalMaterializer.fact(fact, personID: person, source: source, confirmed: true, now: now))))
        }
        for (date, person, leap) in selection.dates {
            changes.append(.upsert(.importantDate(ProposalMaterializer.date(date, personID: person, source: source, confirmed: true, leapDayPolicy: leap, now: now))))
        }
        for (promise, people) in selection.promises {
            changes.append(.upsert(.promise(ProposalMaterializer.promise(promise, personIDs: people, source: source, confirmed: true, now: now))))
        }
        for (event, person) in selection.lifeEvents {
            changes.append(.upsert(.lifeEvent(ProposalMaterializer.lifeEvent(event, personID: person, source: source, confirmed: true, now: now))))
        }
        try await commit(changes)
    }

    public var reviewQueue: [ReviewItem] { ReviewQueue.items(in: snapshot) }

    public func resolve(_ item: ReviewItem, accept: Bool, leapDayPolicy: LeapDayPolicy? = nil) async throws {
        try await commit(ReviewQueue.changes(for: item, accept: accept, leapDayPolicy: leapDayPolicy, in: snapshot, now: now))
    }

    public func sourceDeletionPreview(_ sourceID: SourceID, keepConfirmed: Bool) -> SourceDeletionPlan {
        DeletionPlanner.planSourceDeletion(sourceID, in: snapshot, resolution: keepConfirmed ? .keepConfirmedAsOwnNotes : .deleteDerived, now: now)
    }

    public func deleteSource(_ plan: SourceDeletionPlan) async throws {
        try await commit(plan.changes)
    }

    // MARK: Dates, promises, interactions, trips, gifts

    public func save(_ date: ImportantDate) async throws { try await commit([.upsert(.importantDate(date))]) }
    public func save(_ promise: Promise) async throws { try await commit([.upsert(.promise(promise))]) }
    public func save(_ gift: GiftIdea) async throws { try await commit([.upsert(.gift(gift))]) }
    public func save(_ trip: Trip) async throws { try await commit([.upsert(.trip(trip))]) }

    public func setPromiseStatus(_ id: PromiseID, _ status: PromiseStatus) async throws {
        guard var promise = snapshot.promises[id] else { return }
        promise.status = status
        promise.completedAt = status == .open ? nil : now
        promise.updatedAt = now
        var changes: [RecordChange] = [.upsert(.promise(promise))]
        // Resolve related cards so they never reappear.
        for record in snapshot.suggestions.values where record.evidence.contains(.promise(id)) && !record.state.isTerminal {
            var updated = record
            updated.state = status == .done ? .completed : .invalidated
            updated.updatedAt = now
            changes.append(.upsert(.suggestion(updated)))
        }
        try await commit(changes)
    }

    @discardableResult
    public func logInteraction(with people: [PersonID], kind: InteractionKind, at date: Date? = nil, summary: String? = nil) async throws -> Interaction {
        let interaction = Interaction(personIDs: people, kind: kind, occurredAt: date ?? now, confirmation: .userConfirmed, summary: summary, createdAt: now)
        try await commit([.upsert(.interaction(interaction))])
        return interaction
    }

    /// Establishes a real starting point for check-in reminders (FR5).
    public func setBaseline(for personID: PersonID, lastCaughtUp day: CalendarDay) async throws {
        _ = try await logInteraction(with: [personID], kind: .other, at: day.date(at: TimeOfDay(hour: 12), in: context.timeZone), summary: "Starting point you set")
    }

    public func setGiftState(_ id: GiftIdeaID, _ state: GiftState) async throws {
        guard var gift = snapshot.gifts[id] else { return }
        gift.state = state
        gift.stateChangedAt = now
        if state == .given { gift.givenOn = context.today }
        try await commit([.upsert(.gift(gift))])
    }

    // MARK: Cards (FR7)

    public func perform(_ action: CardAction, on card: SuggestionCard) async throws {
        let existing = snapshot.suggestions[card.occurrenceKey]
        var changes: [RecordChange] = []
        switch action {
        case .snooze:
            let until = context.today.adding(days: 1).date(at: snapshot.preferences.digestTime, in: context.timeZone)
            changes.append(.upsert(.suggestion(SuggestionTransitions.apply(.snooze(until: until), to: card, existing: existing, now: now))))
        case .remindTonight:
            let until = SuggestionTransitions.tonight(context: context, quietHours: snapshot.preferences.quietHours)
            changes.append(.upsert(.suggestion(SuggestionTransitions.apply(.snooze(until: until), to: card, existing: existing, now: now))))
        case .dismiss:
            changes.append(.upsert(.suggestion(SuggestionTransitions.apply(.dismiss, to: card, existing: existing, now: now))))
        case .done:
            changes.append(.upsert(.suggestion(SuggestionTransitions.apply(.complete, to: card, existing: existing, now: now))))
            for ref in card.evidence {
                if case .importantDate(let id) = ref, var date = snapshot.importantDates[id], let day = card.occurrenceKey.split(separator: "|").last.flatMap({ CalendarDay(isoString: String($0)) }) {
                    date.completedOccurrences.insert(day)
                    date.updatedAt = now
                    changes.append(.upsert(.importantDate(date)))
                }
                if case .promise(let id) = ref, var promise = snapshot.promises[id] {
                    promise.status = .done
                    promise.completedAt = now
                    promise.updatedAt = now
                    changes.append(.upsert(.promise(promise)))
                }
            }
        case .logCatchUp:
            changes.append(.upsert(.interaction(Interaction(personIDs: [card.personID], kind: .other, occurredAt: now, confirmation: .userConfirmed, summary: "Caught up", createdAt: now))))
            changes.append(.upsert(.suggestion(SuggestionTransitions.apply(.complete, to: card, existing: existing, now: now))))
        case .review, .draftMessage, .planGift, .confirmAttendance, .setBaseline, .openBrief:
            return // handled by dedicated flows in the UI
        }
        try await commit(changes)
    }

    public func confirmAttendance(_ linkID: CalendarLinkID, happened: Bool) async throws {
        guard let link = snapshot.calendarLinks[linkID] else { return }
        try await commit(CalendarReconciler.confirmAttendance(link, happened: happened, now: now))
    }

    public func brief(for linkID: CalendarLinkID) -> MeetingBrief? {
        snapshot.calendarLinks[linkID].map { BriefBuilder.build(for: $0, in: snapshot, context: context, locale: env.locale) }
    }

    public func linkCalendarEvent(_ event: CalendarEventInfo, people: [PersonID], context calendarContext: CalendarContext) async throws {
        let link = CalendarReconciler.link(for: event, people: people, context: calendarContext, cacheTitles: snapshot.preferences.cacheCalendarTitles, now: now)
        try await commit([.upsert(.calendarLink(link))])
    }

    /// Best-effort refresh of linked events. Denied access changes nothing and is reported.
    public func refreshCalendar(using provider: any CalendarProviding) async -> PermissionState {
        let state = provider.authorizationState()
        guard state.canRead else { return state }
        var results: [CalendarLinkID: CalendarEventInfo?] = [:]
        for link in snapshot.calendarLinks.values {
            results[link.id] = try? await provider.event(identifier: link.eventIdentifier, occurrenceStart: link.occurrenceStart)
        }
        let changes = CalendarReconciler.reconcile(Array(snapshot.calendarLinks.values), with: .events(results), cacheTitles: snapshot.preferences.cacheCalendarTitles, now: now)
        try? await commit(changes)
        return state
    }

    // MARK: Drafts and handoff (FR8)

    public func occasion(for card: SuggestionCard) -> DraftOccasion {
        switch card.ruleID {
        case .dateUpcoming:
            if let ref = card.evidence.first(where: { if case .importantDate = $0 { return true } else { return false } }),
               case .importantDate(let id) = ref, let date = snapshot.importantDates[id] {
                switch date.category {
                case .birthday: return .birthday
                case .anniversary: return .anniversary
                case .careful: return .carefulDate
                case .milestone, .customAnnual: return .milestone(date.label)
                }
            }
            return .generic
        case .lifeUpdate:
            for ref in card.evidence {
                if case .lifeEvent(let id) = ref, let event = snapshot.lifeEvents[id] {
                    return event.category == .newJob ? .newJob : .lifeUpdate(event.summary)
                }
            }
            return .generic
        case .promiseDue, .pinnedPromise:
            for ref in card.evidence { if case .promise(let id) = ref, let p = snapshot.promises[id] { return .promise(p.description) } }
            return .generic
        case .followUpDue:
            for ref in card.evidence { if case .promise(let id) = ref, let p = snapshot.promises[id] { return .followUp(p.description) } }
            return .generic
        case .travelOverlap:
            for ref in card.evidence {
                if case .trip(let id) = ref, let trip = snapshot.trips[id] {
                    let phrasing = DayPhrasing(locale: env.locale, timeZone: context.timeZone)
                    return .travel(city: trip.city, dates: "\(phrasing.shortMonthDay(trip.startDay))–\(phrasing.shortMonthDay(trip.endDay))", uncertain: trip.isUncertain)
                }
            }
            return .generic
        case .cadenceCheck, .cadenceBaseline, .rhythmLull: return .checkIn
        case .meetingBrief, .meetingFollowUp: return .generic
        }
    }

    /// Confirmed, person-scoped context the user may choose to include in a draft. Nothing
    /// from other people or unconfirmed sources is offered.
    public func draftContext(for personID: PersonID) -> [DraftContextItem] {
        snapshot.facts.values
            .filter { $0.personID == personID && $0.state == .confirmed }
            .sorted { $0.id < $1.id }
            .map { DraftContextItem(evidence: .fact($0.id), phrase: $0.value, isSensitive: $0.isSensitive, isConfirmed: true) }
    }

    public func makeDraft(for card: SuggestionCard, tone: DraftTone, selected: [DraftContextItem] = [], allowSensitive: Set<EvidenceRef> = []) async throws -> Draft {
        guard let person = snapshot.people[card.personID] else { throw AppError.personNotFound }
        let composed = DraftComposer().compose(occasion: occasion(for: card), name: person.name, tone: tone, selected: selected, explicitlyAllowedSensitive: allowSensitive)
        let recipient = person.phoneNumbers.first.map { DraftRecipient(personID: person.id, channel: .sms, address: $0.value) }
            ?? person.emailAddresses.first.map { DraftRecipient(personID: person.id, channel: .email, address: $0.value) }
        let draft = Draft(personID: person.id, suggestionKey: card.occurrenceKey, evidence: composed.usedEvidence, text: composed.text, tone: tone, recipient: recipient, createdAt: now)
        try await commit([.upsert(.draft(draft))])
        return draft
    }

    public func updateDraft(_ draft: Draft) async throws {
        var d = draft
        d.updatedAt = now
        try await commit([.upsert(.draft(d))])
    }

    /// Runs the action policy for a user-initiated handoff. The user's tap on "Open in
    /// Messages/Mail" (with recipient and text visible) is the approval; the system composer
    /// remains the final review step and nothing is sent unattended.
    public func prepareHandoff(_ draft: Draft) -> PolicyDecision {
        let proposal = ActionProposal(kind: .sendMessage, recipientPersonID: draft.recipient?.personID ?? draft.personID, recipientAddress: draft.recipient?.address, channel: draft.recipient?.channel, payload: draft.text, evidence: draft.evidence, origin: .user)
        let approval = UserApproval(proposalDigest: proposal.digest, approvedAt: now)
        return ActionPolicy().evaluate(proposal, approval: approval, context: PolicyContext(snapshot: snapshot, evaluation: context))
    }

    /// Records what the composer reported. Only a reported or user-confirmed send becomes an
    /// interaction; delivery is never claimed.
    public func recordComposerResult(_ result: ComposerResult, for draftID: DraftID) async throws {
        guard var draft = snapshot.drafts[draftID] else { return }
        var changes: [RecordChange] = []
        switch result {
        case .sent: draft.outcome = .systemReportedSent
        case .cancelled: draft.outcome = .cancelled
        case .failed: draft.outcome = .failed
        case .unavailable: draft.outcome = .editing
        }
        draft.updatedAt = now
        changes.append(.upsert(.draft(draft)))
        if draft.outcome.countsAsInteraction {
            changes.append(.upsert(.interaction(Interaction(personIDs: [draft.personID], kind: .message, occurredAt: now, confirmation: .userConfirmed, summary: "Sent a message", createdAt: now))))
        }
        try await commit(changes)
    }

    /// For share-sheet or copy handoffs where the system can't report an outcome.
    public func markHandedOff(_ draftID: DraftID) async throws {
        guard var draft = snapshot.drafts[draftID] else { return }
        draft.outcome = .handedOff
        draft.updatedAt = now
        try await commit([.upsert(.draft(draft))])
    }

    public func confirmDraftSent(_ draftID: DraftID, sent: Bool) async throws {
        guard var draft = snapshot.drafts[draftID] else { return }
        draft.outcome = sent ? .userConfirmedSent : .userReportedNotSent
        draft.updatedAt = now
        var changes: [RecordChange] = [.upsert(.draft(draft))]
        if sent {
            changes.append(.upsert(.interaction(Interaction(personIDs: [draft.personID], kind: .message, occurredAt: now, confirmation: .userConfirmed, summary: "Sent a message", createdAt: now))))
        }
        try await commit(changes)
    }

    // MARK: Imports and share inbox (FR12)

    public func previewWhatsAppImport(_ text: String, selfName: String, mapping: [String: PersonID], preferDayFirst: Bool = false) -> (ParsedChat, ImportPlan) {
        let chat = WhatsAppChatParser.parse(text, timeZone: context.timeZone, preferDayFirst: preferDayFirst)
        return (chat, ImportPlanner.planWhatsApp(chat, selfName: selfName, mapping: mapping, in: snapshot, importedAt: now, timeZone: context.timeZone))
    }

    public func previewLinkedInImport(_ csv: String, mapping: [String: PersonID]) -> ImportPlan {
        ImportPlanner.planLinkedIn(LinkedInConnectionsParser.parse(csv), mapping: mapping, in: snapshot, importedAt: now)
    }

    public func commitImport(_ plan: ImportPlan) async throws {
        try await commit(plan.changes)
    }

    public func revoke(_ connectionID: ConnectionID, deleteImported: Bool) async throws {
        try await commit(ImportPlanner.planRevocation(of: connectionID, deleteImported: deleteImported, in: snapshot, now: now))
    }

    /// The public key the share extension seals items to. Generated once; the private half
    /// stays in device-only secret storage.
    public func shareInboxPublicKey() throws -> Data {
        if let existing = try env.secrets.data(for: .inboxPrivateKey) {
            return try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: existing).publicKey.rawRepresentation
        }
        let key = Curve25519.KeyAgreement.PrivateKey()
        try env.secrets.set(key.rawRepresentation, for: .inboxPrivateKey)
        return key.publicKey.rawRepresentation
    }

    /// Opens sealed items from the share extension, saves them as sources, and returns
    /// proposals for review. Items are deleted from the inbox only after they are saved.
    public func drainShareInbox() async -> [MemoryCapture] {
        guard phase == .ready, !isDemo, let directory = env.shareInboxDirectory,
              let raw = try? env.secrets.data(for: .inboxPrivateKey),
              let privateKey = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: raw),
              let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        var captures: [MemoryCapture] = []
        for file in files.filter({ $0.pathExtension == "ltin" }).sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            guard let data = try? Data(contentsOf: file), let item = try? ShareInbox.open(data, with: privateKey) else { continue }
            switch CapturePipeline.capture(item, personIDs: [], in: snapshot) {
            case .captured(let source, let record):
                do {
                    try await commit([.upsert(.source(source)), .upsert(.captureRecord(record))])
                    captures.append(try await propose(for: source))
                    try? FileManager.default.removeItem(at: file)
                } catch {
                    lastError = "A shared item couldn't be saved. It's still waiting in the inbox."
                }
            case .duplicate, .empty:
                try? FileManager.default.removeItem(at: file)
            case .importCandidate:
                // Left for the import flow, which shows a preview before saving anything.
                continue
            }
        }
        return captures
    }

    /// Links a captured source to people after review (shared items arrive unlinked).
    public func link(_ sourceID: SourceID, to people: [PersonID]) async throws -> MemoryCapture {
        guard var source = snapshot.sources[sourceID] else { throw AppError.notReady }
        source.personIDs = people
        source.updatedAt = now
        try await commit([.upsert(.source(source))])
        return try await propose(for: source)
    }

    // MARK: Backup and restore (FR11)

    /// Returns the stored recovery key, or creates a new one the user must write down.
    public func recoveryKey(createIfMissing: Bool) throws -> (key: RecoveryKey, isNew: Bool) {
        if let data = try env.secrets.data(for: .recoveryKey) { return (try RecoveryKey(bytes: [UInt8](data)), false) }
        guard createIfMissing else { throw AppError.recoveryKeyMissing }
        let key = RecoveryKey.generate()
        return (key, true)
    }

    /// Stores the recovery key only after the user confirmed they saved it.
    public func confirmRecoveryKeySaved(_ key: RecoveryKey) throws {
        try env.secrets.set(Data(key.bytes), for: .recoveryKey)
    }

    public func exportBackup() async throws -> Data {
        guard let store, !isDemo else { throw AppError.notReady }
        let (key, isNew) = try recoveryKey(createIfMissing: false)
        precondition(!isNew)
        let archive = try await store.exportArchive(recoveryKey: key, appVersion: env.appVersion, now: now)
        var preferences = snapshot.preferences
        preferences.lastBackupAt = now
        try await commit([.setPreferences(preferences)])
        return archive
    }

    public func previewRestore(_ archive: Data, recoveryKeyText: String) throws -> RestorePreview {
        try BackupArchive.preview(archive, recoveryKey: RecoveryKey(parsing: recoveryKeyText))
    }

    /// Replaces the vault after explicit confirmation. Any failure leaves the current vault.
    public func restore(_ archive: Data, recoveryKeyText: String) async throws {
        guard let store, let key, !isDemo else { throw AppError.notReady }
        let recovery = try RecoveryKey(parsing: recoveryKeyText)
        do {
            let restored = try await VaultStore.restore(archive: archive, recoveryKey: recovery, replacing: store, key: key, fileProtection: env.fileProtection)
            self.store = restored
            snapshot = try await restored.loadSnapshot()
            mergeUndoStack = []
            try env.secrets.set(Data(recovery.bytes), for: .recoveryKey)
            await refresh()
        } catch {
            if await !store.isOpen {
                // The final swap failed after closing; reopen the untouched live vault.
                self.store = try? VaultStore(databaseURL: env.databaseURL, key: key, fileProtection: env.fileProtection)
            }
            throw error
        }
    }

    // MARK: Search and views

    public func search(_ query: String) -> [SearchResult] {
        LocalSearch.search(query, in: snapshot)
    }

    public func upcoming(days: Int = 60) -> [UpcomingItem] {
        UpcomingBuilder.items(in: snapshot, context: context, days: days, locale: env.locale)
    }

    public func timeline(for personID: PersonID) -> [TimelineEntry] {
        TimelineBuilder.entries(for: personID, in: snapshot)
    }

    public var sourceRegistry: IntegrationCapabilityRegistry? {
        try? IntegrationCapabilityRegistry.bundled()
    }
}
