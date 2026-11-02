import Foundation
import LTCryptoSupport

/// 256-bit raw key for the SQLCipher database. Generated on device from the system CSPRNG,
/// stored only in device-bound Keychain storage, and never exported in plaintext.
public struct VaultKeyMaterial: Sendable, Equatable {
    public let bytes: [UInt8]

    public init(bytes: [UInt8]) throws {
        guard bytes.count == 32 else { throw VaultError.invalidKey }
        self.bytes = bytes
    }

    public static func generate() -> VaultKeyMaterial {
        let key = SymmetricKey(size: .bits256)
        let bytes = key.withUnsafeBytes { Array($0) }
        // swiftlint:disable:next force_try
        return try! VaultKeyMaterial(bytes: bytes)
    }

    /// SQLCipher raw-key literal (`x'..'`), which skips SQLCipher's own passphrase KDF
    /// because the key is already uniformly random.
    var sqlCipherLiteral: String {
        "\"x'" + bytes.map { String(format: "%02X", $0) }.joined() + "'\""
    }
}

/// Device-bound storage for the vault key. The iOS implementation keeps the key in the
/// Keychain with `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` and a `.userPresence`
/// access control, so reading it requires Face ID / Touch ID / passcode and the key never
/// leaves the device in backups.
public protocol VaultKeyStore: Sendable {
    /// Whether a vault key exists on this device.
    func hasKey() throws -> Bool
    /// Generates and stores a new key. Fails if the device cannot protect it (no passcode).
    func createKey() throws -> VaultKeyMaterial
    /// Reads the key, prompting for device-owner authentication where required.
    func readKey(reason: String) async throws -> VaultKeyMaterial
    /// Irreversibly deletes the key.
    func deleteKey() throws
}

/// Applies platform file protection to vault files. On iOS this sets
/// `FileProtectionType.complete` and excludes the directory from device backups.
public protocol VaultFileProtecting: Sendable {
    func protectDirectory(_ url: URL) throws
    func protectFile(_ url: URL) throws
}

public struct NoFileProtection: VaultFileProtecting {
    public init() {}
    public func protectDirectory(_ url: URL) throws {}
    public func protectFile(_ url: URL) throws {}
}

public enum VaultError: Error, Equatable, Sendable {
    case invalidKey
    /// SQLCipher is not linked (plain SQLite would store plaintext). Fail closed.
    case encryptionUnavailable
    /// Wrong key or the file is not a vault.
    case cannotDecrypt
    case newerSchema(found: Int, supported: Int)
    case closed
    case integrityViolation(String)
    case decodingFailed(table: String)
    case storage(code: Int32, message: String)
    case deviceProtectionUnavailable
}
