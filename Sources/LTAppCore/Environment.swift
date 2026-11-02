import Foundation
import LTDomain
import LTIntegrations
import LTIntelligence
import LTVault

/// Small secrets kept in device-only Keychain storage on iOS.
public enum SecretName: String, Sendable, CaseIterable {
    /// The user's backup recovery key (after they confirmed writing it down).
    case recoveryKey
    /// Private half of the share-inbox key pair. The share extension only has the public half.
    case inboxPrivateKey
}

public protocol SecretStoring: Sendable {
    func data(for name: SecretName) throws -> Data?
    func set(_ data: Data, for name: SecretName) throws
    func delete(_ name: SecretName) throws
}

/// Everything the app model needs from the platform, injected so it can be tested.
public struct AppEnvironment: Sendable {
    public var vaultDirectory: URL
    public var keyStore: any VaultKeyStore
    public var secrets: any SecretStoring
    public var fileProtection: any VaultFileProtecting
    public var deviceProtection: any DeviceProtectionChecking
    public var clock: any WallClock
    public var currentTimeZone: @Sendable () -> TimeZone
    public var notifications: any NotificationScheduling
    /// On-device model, if the platform offers one. Never a remote service.
    public var localModel: (any LocalExtractionModel)?
    /// App Group directory where the share extension drops sealed items.
    public var shareInboxDirectory: URL?
    public var appVersion: String
    public var locale: Locale

    public init(
        vaultDirectory: URL,
        keyStore: any VaultKeyStore,
        secrets: any SecretStoring,
        fileProtection: any VaultFileProtecting = NoFileProtection(),
        deviceProtection: any DeviceProtectionChecking,
        clock: any WallClock = SystemWallClock(),
        currentTimeZone: @escaping @Sendable () -> TimeZone = { TimeZone.current },
        notifications: any NotificationScheduling,
        localModel: (any LocalExtractionModel)? = nil,
        shareInboxDirectory: URL? = nil,
        appVersion: String,
        locale: Locale = Locale(identifier: "en_US")
    ) {
        self.vaultDirectory = vaultDirectory
        self.keyStore = keyStore
        self.secrets = secrets
        self.fileProtection = fileProtection
        self.deviceProtection = deviceProtection
        self.clock = clock
        self.currentTimeZone = currentTimeZone
        self.notifications = notifications
        self.localModel = localModel
        self.shareInboxDirectory = shareInboxDirectory
        self.appVersion = appVersion
        self.locale = locale
    }

    public var databaseURL: URL { vaultDirectory.appendingPathComponent("vault.ltdb") }
}
