import Foundation
import LTCryptoSupport
import LTDomain

/// Something the user explicitly shared into LittleThings from another app.
public struct InboxItem: Codable, Sendable, Hashable {
    public var id: UUID
    public var receivedAt: Date
    public var text: String?
    public var url: URL?
    public var fileName: String?
    public var fileData: Data?
    public var contentType: String?

    public init(id: UUID = UUID(), receivedAt: Date, text: String? = nil, url: URL? = nil, fileName: String? = nil, fileData: Data? = nil, contentType: String? = nil) {
        self.id = id
        self.receivedAt = receivedAt
        self.text = text
        self.url = url
        self.fileName = fileName
        self.fileData = fileData
        self.contentType = contentType
    }
}

public enum ShareInboxError: Error, Equatable {
    case tooLarge
    case malformed
    case unsupportedVersion
}

/// The share extension cannot open the vault. It seals each shared item to the main app's
/// public key with HPKE (X25519, HKDF-SHA256, ChaCha20-Poly1305) and writes it to the
/// App Group container. Only the main app holds the private key (device-only Keychain), so
/// the extension can add items but never read them back or read the vault.
public enum ShareInbox {
    public static let ciphersuite = HPKE.Ciphersuite.Curve25519_SHA256_ChachaPoly
    public static let info = Data("LittleThings share inbox v1".utf8)
    public static let magic = Data("LTIN".utf8)
    public static let version: UInt8 = 1
    public static let maximumPayloadBytes = 25 * 1024 * 1024

    public static func seal(_ item: InboxItem, to recipient: Curve25519.KeyAgreement.PublicKey) throws -> Data {
        let plaintext = try JSONEncoder().encode(item)
        guard plaintext.count <= maximumPayloadBytes else { throw ShareInboxError.tooLarge }
        var sender = try HPKE.Sender(recipientKey: recipient, ciphersuite: ciphersuite, info: info)
        let encapsulated = sender.encapsulatedKey
        var header = magic
        header.append(version)
        header.append(UInt8(encapsulated.count >> 8))
        header.append(UInt8(encapsulated.count & 0xFF))
        header.append(encapsulated)
        let ciphertext = try sender.seal(plaintext, authenticating: header)
        return header + ciphertext
    }

    public static func open(_ sealed: Data, with privateKey: Curve25519.KeyAgreement.PrivateKey) throws -> InboxItem {
        let bytes = [UInt8](sealed)
        guard bytes.count > 7, Data(bytes[0..<4]) == magic else { throw ShareInboxError.malformed }
        guard bytes[4] == version else { throw ShareInboxError.unsupportedVersion }
        let keyLength = Int(bytes[5]) << 8 | Int(bytes[6])
        guard bytes.count > 7 + keyLength else { throw ShareInboxError.malformed }
        let encapsulated = Data(bytes[7..<(7 + keyLength)])
        let header = Data(bytes[0..<(7 + keyLength)])
        let ciphertext = Data(bytes[(7 + keyLength)...])
        var recipient = try HPKE.Recipient(privateKey: privateKey, ciphersuite: ciphersuite, info: info, encapsulatedKey: encapsulated)
        let plaintext = try recipient.open(ciphertext, authenticating: header)
        return try JSONDecoder().decode(InboxItem.self, from: plaintext)
    }

    /// Opaque file name for an inbox item (no content, no names).
    public static func fileName(for item: InboxItem) -> String {
        "item-\(item.id.uuidString.lowercased()).ltin"
    }
}

/// Normalizes captured material into evidence before any extraction (FR12, PRD section 8).
public enum CapturePipeline {
    public static func fingerprint(provider: String, content: String) -> String {
        let normalized = content.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        let digest = SHA256.hash(data: Data("\(provider)|\(normalized)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    public enum Outcome: Sendable, Hashable {
        /// New evidence ready for review/extraction.
        case captured(Source, CaptureRecord)
        /// The same content was captured before; nothing is added.
        case duplicate(existingSource: SourceID?)
        /// The shared file is a recognized export; route to the import preview instead.
        case importCandidate(ImportFormat)
        /// Nothing usable (for example an empty share).
        case empty
    }

    /// Converts a shared item into a `Source`. Parsing happens locally; nothing is sent anywhere.
    public static func capture(_ item: InboxItem, personIDs: [PersonID], in snapshot: VaultSnapshot, provider: String = "share-extension") -> Outcome {
        if let data = item.fileData, let format = ImportFormat.detect(fileName: item.fileName, data: data) {
            return .importCandidate(format)
        }
        var parts: [String] = []
        if let text = item.text?.trimmed, !text.isEmpty { parts.append(text) }
        if let fileText = item.fileData.flatMap({ String(data: $0, encoding: .utf8) })?.trimmed, !fileText.isEmpty { parts.append(fileText) }
        if let url = item.url, !parts.contains(where: { $0.contains(url.absoluteString) }) { parts.append(url.absoluteString) }
        guard !parts.isEmpty else { return .empty }
        let text = parts.joined(separator: "\n\n")
        let fp = fingerprint(provider: provider, content: text)
        if let existing = snapshot.captureRecords.values.first(where: { $0.provider == provider && $0.fingerprint == fp }) {
            return .duplicate(existingSource: existing.sourceID)
        }
        let source = Source(
            kind: .shareExtension,
            provider: provider,
            title: item.url?.host,
            capturedAt: item.receivedAt,
            text: text,
            personIDs: personIDs,
            fingerprint: fp
        )
        let record = CaptureRecord(provider: provider, fingerprint: fp, sourceID: source.id, personIDs: personIDs, capturedAt: item.receivedAt)
        return .captured(source, record)
    }
}

public enum ImportFormat: String, Sendable, Hashable {
    case whatsAppChat = "whatsapp-chat-export"
    case linkedInConnections = "linkedin-data-archive-import"

    public static func detect(fileName: String?, data: Data) -> ImportFormat? {
        guard let text = String(data: data.prefix(64 * 1024), encoding: .utf8) else { return nil }
        let name = fileName?.lowercased() ?? ""
        if name.hasSuffix(".csv") || text.contains("First Name,Last Name") {
            if text.contains("First Name,Last Name") && text.contains("Connected On") { return .linkedInConnections }
        }
        if (name.contains("whatsapp") || name.hasSuffix(".txt")) && WhatsAppChatParser.looksLikeExport(text) {
            return .whatsAppChat
        }
        return nil
    }
}
