import Foundation
import LocalAuthentication
import LTAppCore
import LTVault
import Security

/// Vault key in the data-protection Keychain:
/// - `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`: requires a device passcode, never
///   leaves the device in backups or device migration, and is deleted if the passcode is removed.
/// - `.userPresence`: every read requires Face ID / Touch ID / passcode. Reading the key is the
///   app lock.
///
/// UNVERIFIED: not compiled or run in this environment (no Xcode). Device test required.
struct KeychainVaultKeyStore: VaultKeyStore {
    let service = "littlethings.vault"
    let account = "vault-key-v1"

    func hasKey() throws -> Bool {
        let context = LAContext()
        context.interactionNotAllowed = true // never prompt just to check existence
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
            kSecUseAuthenticationContext as String: context,
            kSecReturnData as String: false,
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        switch status {
        case errSecSuccess, errSecInteractionNotAllowed: return true
        case errSecItemNotFound: return false
        default: throw KeychainError.status(status)
        }
    }

    func createKey() throws -> VaultKeyMaterial {
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .userPresence, &error) else {
            throw VaultError.deviceProtectionUnavailable
        }
        let key = VaultKeyMaterial.generate()
        try? deleteKey()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
            kSecAttrAccessControl as String: access,
            kSecAttrSynchronizable as String: false,
            kSecValueData as String: Data(key.bytes),
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            // errSecDecode / errSecParam here typically means no passcode is set.
            throw VaultError.deviceProtectionUnavailable
        }
        return key
    }

    func readKey(reason: String) async throws -> VaultKeyMaterial {
        let service = self.service
        let account = self.account
        // SecItemCopyMatching blocks while the system shows the authentication UI.
        return try await Task.detached(priority: .userInitiated) {
            let context = LAContext()
            context.localizedReason = reason
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecUseDataProtectionKeychain as String: true,
                kSecUseAuthenticationContext as String: context,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne,
            ]
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            guard status == errSecSuccess, let data = result as? Data else { throw KeychainError.status(status) }
            return try VaultKeyMaterial(bytes: [UInt8](data))
        }.value
    }

    func deleteKey() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError.status(status) }
    }
}

/// Small device-only secrets (recovery key, share-inbox private key). Readable only while the
/// device is unlocked, never synchronized or backed up.
struct KeychainSecrets: SecretStoring {
    let service = "littlethings.secrets"

    func data(for name: SecretName) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name.rawValue,
            kSecUseDataProtectionKeychain as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError.status(status) }
        return result as? Data
    }

    func set(_ data: Data, for name: SecretName) throws {
        try? delete(name)
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name.rawValue,
            kSecUseDataProtectionKeychain as String: true,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: false,
            kSecValueData as String: data,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.status(status) }
    }

    func delete(_ name: SecretName) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name.rawValue,
            kSecUseDataProtectionKeychain as String: true,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError.status(status) }
    }
}

enum KeychainError: Error {
    case status(OSStatus)
}
