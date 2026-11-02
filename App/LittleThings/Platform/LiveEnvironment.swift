import Foundation
import LTAppCore
import LTDomain
import LTIntegrations
import LTIntelligence
import LTVault

enum LiveEnvironment {
    static var appGroupDirectory: URL? {
        guard let id = Bundle.main.object(forInfoDictionaryKey: "LTAppGroupIdentifier") as? String else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    static var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        return "\(version) (\(build))"
    }

    static func make() -> AppEnvironment {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-testing") { return uiTesting() }
        #endif
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var localModel: (any LocalExtractionModel)?
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) { localModel = FoundationModelsExtractor() }
        #endif
        return AppEnvironment(
            vaultDirectory: support.appendingPathComponent("Vault", isDirectory: true),
            keyStore: KeychainVaultKeyStore(),
            secrets: KeychainSecrets(),
            fileProtection: IOSFileProtection(),
            deviceProtection: LocalAuthenticationProtection(),
            notifications: UserNotificationScheduler(),
            localModel: localModel,
            shareInboxDirectory: appGroupDirectory?.appendingPathComponent("ShareInbox", isDirectory: true),
            appVersion: appVersion,
            locale: .current
        )
    }

    /// Publishes the share-inbox public key to the App Group so the extension can seal items.
    /// The public key is not secret; the private key stays in the main app's Keychain.
    @MainActor
    static func publishShareInboxKey(from model: AppModel) {
        guard !model.isDemo, let dir = appGroupDirectory, let key = try? model.shareInboxPublicKey() else { return }
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("ShareInbox"), withIntermediateDirectories: true)
        try? key.write(to: dir.appendingPathComponent("inbox-public-key"), options: .atomic)
    }

    #if DEBUG
    /// Deterministic, prompt-free environment for UI tests: no Keychain, no permissions.
    static func uiTesting() -> AppEnvironment {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ui-tests-\(ProcessInfo.processInfo.processIdentifier)")
        return AppEnvironment(
            vaultDirectory: dir.appendingPathComponent("Vault", isDirectory: true),
            keyStore: UITestKeyStore.shared,
            secrets: UITestSecrets.shared,
            deviceProtection: UITestProtection(),
            notifications: UITestNotifications.shared,
            localModel: nil,
            shareInboxDirectory: dir.appendingPathComponent("ShareInbox", isDirectory: true),
            appVersion: "ui-test"
        )
    }
    #endif
}

#if DEBUG
final class UITestKeyStore: VaultKeyStore, @unchecked Sendable {
    static let shared = UITestKeyStore()
    private let lock = NSLock()
    private var key: VaultKeyMaterial?
    func hasKey() throws -> Bool { lock.withLock { key != nil } }
    func createKey() throws -> VaultKeyMaterial { lock.withLock { let k = VaultKeyMaterial.generate(); key = k; return k } }
    func readKey(reason: String) async throws -> VaultKeyMaterial {
        try lock.withLock { guard let key else { throw VaultError.invalidKey }; return key }
    }
    func deleteKey() throws { lock.withLock { key = nil } }
}

final class UITestSecrets: SecretStoring, @unchecked Sendable {
    static let shared = UITestSecrets()
    private let lock = NSLock()
    private var values: [SecretName: Data] = [:]
    func data(for name: SecretName) throws -> Data? { lock.withLock { values[name] } }
    func set(_ data: Data, for name: SecretName) throws { lock.withLock { values[name] = data } }
    func delete(_ name: SecretName) throws { lock.withLock { values[name] = nil } }
}

struct UITestProtection: DeviceProtectionChecking {
    func currentProtection() -> DeviceProtection { .available(.faceID) }
}

final class UITestNotifications: NotificationScheduling, @unchecked Sendable {
    static let shared = UITestNotifications()
    private let lock = NSLock()
    private var pending: Set<String> = []
    func authorization() async -> NotificationAuthorization { .denied }
    func requestAuthorization() async -> NotificationAuthorization { .denied }
    func pendingIdentifiers() async -> [String] { lock.withLock { Array(pending) } }
    func schedule(_ notifications: [PlannedNotification]) async throws { lock.withLock { notifications.forEach { pending.insert($0.identifier) } } }
    func removePending(identifiers: [String]) async { lock.withLock { identifiers.forEach { pending.remove($0) } } }
    func removeAll() async { lock.withLock { pending = [] } }
}
#endif
