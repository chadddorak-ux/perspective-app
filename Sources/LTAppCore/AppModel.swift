import Foundation
import Observation
import LTCapture
import LTCryptoSupport
import LTDomain
import LTIntegrations
import LTIntelligence
import LTPolicy
import LTSuggestions
import LTVault

public struct TodayState: Sendable, Equatable {
    public var visible: [SuggestionCard]
    public var more: [SuggestionCard]

    public static let empty = TodayState(visible: [], more: [])
}

public enum AppError: Error, Equatable, Sendable {
    case notReady
    case personNotFound
    case nothingToUndo
    case recoveryKeyMissing
    case message(String)
}

/// The application model the SwiftUI app binds to. Owns the unlocked vault session.
///
/// Plaintext lives in memory only while the vault is unlocked; `lock()` closes the database,
/// drops the key reference and clears the in-memory snapshot.
@MainActor
@Observable
public final class AppModel {
    public enum Phase: Equatable, Sendable {
        case starting
        /// No vault yet: first-session explanation and setup.
        case onboarding
        /// The device cannot protect real data (no passcode). Demo mode still works.
        case protectionRequired(String)
        case locked
        case ready
        /// The vault exists but cannot be opened. Fails closed; nothing is shown in plaintext.
        case failed(String)
    }

    public internal(set) var phase: Phase = .starting
    public internal(set) var snapshot = VaultSnapshot() {
        didSet { searchCorpus = nil }
    }
    public internal(set) var today = TodayState.empty
    public private(set) var isDemo = false
    public private(set) var notificationAuthorization: NotificationAuthorization = .notDetermined
    public private(set) var localModelAvailability: LocalModelAvailability = .unavailable(.other)
    public var lastError: String?

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored let engine: SuggestionEngine
    @ObservationIgnored let planner: NotificationPlanner
    @ObservationIgnored var store: VaultStore?
    @ObservationIgnored var key: VaultKeyMaterial?
    @ObservationIgnored var demoDirectory: URL?
    @ObservationIgnored var backgroundedAt: Date?
    /// Merges can be undone within the current session only (FR1).
    @ObservationIgnored var mergeUndoStack: [MergePlan] = []
    /// In-memory search corpus, rebuilt lazily after any snapshot change. Never persisted.
    @ObservationIgnored var searchCorpus: LocalSearch.Corpus?

    public init(environment: AppEnvironment) {
        env = environment
        engine = SuggestionEngine(locale: environment.locale)
        planner = NotificationPlanner(engine: SuggestionEngine(locale: environment.locale))
    }

    public var context: EvaluationContext {
        let zone = snapshot.preferences.fixedTimeZoneIdentifier.flatMap(TimeZone.init(identifier:)) ?? env.currentTimeZone()
        return EvaluationContext(now: env.clock.now, timeZone: zone)
    }

    public var deviceProtection: DeviceProtection { env.deviceProtection.currentProtection() }

    // MARK: Lifecycle

    public func start() {
        localModelAvailability = env.localModel?.availability() ?? .unavailable(.deviceNotEligible)
        if (try? env.keyStore.hasKey()) == true {
            phase = .locked
        } else {
            phase = .onboarding
        }
    }

    /// Creates the encrypted vault after the first-session explanation.
    public func createVault() async {
        guard deviceProtection.canStoreRealData else {
            phase = .protectionRequired("Set a device passcode in Settings to store real information. LittleThings uses it to protect the encrypted vault. You can explore the demo in the meantime.")
            return
        }
        do {
            let key = try env.keyStore.createKey()
            try await open(with: key)
        } catch VaultError.deviceProtectionUnavailable {
            phase = .protectionRequired("This device can't protect the vault key. Set a passcode to continue.")
        } catch {
            phase = .failed("The vault couldn't be created.")
        }
    }

    /// Prompts for Face ID / Touch ID / passcode via the key store and opens the vault.
    public func unlock() async {
        guard phase == .locked || phase == .starting else { return }
        do {
            let key = try await env.keyStore.readKey(reason: "Unlock your LittleThings vault")
            try await open(with: key)
        } catch VaultError.cannotDecrypt {
            phase = .failed("The vault can't be opened on this device. Restore from a backup or delete it and start over.")
        } catch VaultError.newerSchema {
            phase = .failed("This vault was created by a newer version of LittleThings. Update the app to open it.")
        } catch {
            phase = .locked
            lastError = "Authentication was cancelled or failed."
        }
    }

    func open(with key: VaultKeyMaterial) async throws {
        let store = try VaultStore(databaseURL: env.databaseURL, key: key, fileProtection: env.fileProtection)
        let loaded = try await store.loadSnapshot()
        self.store = store
        self.key = key
        self.snapshot = loaded
        self.isDemo = false
        phase = .ready
        await refresh()
    }

    public func lock() async {
        if isDemo { return }
        await store?.close()
        store = nil
        key = nil
        snapshot = VaultSnapshot()
        today = .empty
        mergeUndoStack = []
        phase = (try? env.keyStore.hasKey()) == true ? .locked : .onboarding
    }

    public func didEnterBackground() {
        backgroundedAt = env.clock.now
    }

    /// Re-locks after the configured background timeout.
    public func willEnterForeground() async {
        defer { backgroundedAt = nil }
        guard phase == .ready, !isDemo, let since = backgroundedAt else { return }
        if env.clock.now.timeIntervalSince(since) >= Double(snapshot.preferences.appLockTimeoutSeconds) {
            await lock()
        } else {
            await refresh()
        }
    }

    // MARK: Demo (synthetic, never mixed with real records)

    public func startDemo() async {
        do {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("littlethings-demo-\(UUID().uuidString)", isDirectory: true)
            let store = try VaultStore(databaseURL: dir.appendingPathComponent("demo.ltdb"), key: .generate())
            let demo = DemoContent.make(now: env.clock.now, timeZone: env.currentTimeZone())
            try await store.apply(demo.allRecords.map { .upsert($0) } + [.setPreferences(demo.preferences)])
            self.store = store
            self.demoDirectory = dir
            self.snapshot = try await store.loadSnapshot()
            self.isDemo = true
            phase = .ready
            await refresh()
        } catch {
            lastError = "The demo couldn't start."
        }
    }

    public func exitDemo() async {
        guard isDemo else { return }
        await store?.close()
        if let demoDirectory { try? FileManager.default.removeItem(at: demoDirectory) }
        store = nil
        demoDirectory = nil
        snapshot = VaultSnapshot()
        today = .empty
        isDemo = false
        phase = (try? env.keyStore.hasKey()) == true ? .locked : .onboarding
    }

    // MARK: Persistence core

    /// Applies changes to the vault and the in-memory snapshot, then refreshes cards and
    /// notifications.
    public func commit(_ changes: [RecordChange]) async throws {
        guard let store, phase == .ready else { throw AppError.notReady }
        try await store.apply(changes)
        snapshot.apply(changes)
        await refresh()
    }

    /// Recomputes Today, persists card state transitions and reconciles notifications.
    public func refresh() async {
        guard phase == .ready else { return }
        let result = engine.evaluate(snapshot, context: context)
        if !result.stateChanges.isEmpty, let store {
            do {
                try await store.apply(result.stateChanges)
                snapshot.apply(result.stateChanges)
            } catch {
                lastError = "Couldn't save suggestion state."
            }
        }
        today = TodayState(visible: result.visible, more: result.more)
        await reconcileNotifications()
    }

    func reconcileNotifications() async {
        let authorization = await env.notifications.authorization()
        notificationAuthorization = authorization
        guard !isDemo else { return }
        let desired = planner.plan(snapshot, context: context)
        let pending = await env.notifications.pendingIdentifiers()
        let diff = NotificationPlanner.reconcile(desired: desired, pendingIdentifiers: pending, authorization: authorization)
        if !diff.remove.isEmpty { await env.notifications.removePending(identifiers: diff.remove) }
        if !diff.add.isEmpty { try? await env.notifications.schedule(diff.add) }
    }

    /// Ask only after the user has seen a useful card (first-session step 5).
    public func requestNotificationPermission() async {
        notificationAuthorization = await env.notifications.requestAuthorization()
        var preferences = snapshot.preferences
        preferences.notificationPermissionRequested = true
        try? await commit([.setPreferences(preferences)])
    }

    public func updatePreferences(_ preferences: Preferences) async throws {
        try await commit([.setPreferences(preferences)])
    }

    // MARK: Delete everything (FR11)

    /// Clears the vault, derived files, pending notifications and every app-managed key, and
    /// returns to onboarding. Exported copies and data already sent elsewhere are not affected.
    public func deleteEverything() async {
        await store?.close()
        store = nil
        key = nil
        if let demoDirectory { try? FileManager.default.removeItem(at: demoDirectory) }
        try? VaultStore.destroyFiles(in: env.vaultDirectory)
        if let inbox = env.shareInboxDirectory { try? FileManager.default.removeItem(at: inbox) }
        try? env.keyStore.deleteKey()
        for name in SecretName.allCases { try? env.secrets.delete(name) }
        await env.notifications.removeAll()
        snapshot = VaultSnapshot()
        today = .empty
        isDemo = false
        mergeUndoStack = []
        phase = .onboarding
    }
}
