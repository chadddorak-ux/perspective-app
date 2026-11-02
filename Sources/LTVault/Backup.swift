import Foundation
import LTCryptoSupport
import LTDomain

/// A 128-bit, app-generated recovery secret the user writes down. Because it is uniformly
/// random (not a human-chosen password), HKDF-SHA256 is an appropriate key derivation; no slow
/// password KDF is needed. Displayed as 28 Crockford base32 characters: 26 for the key and
/// 2 for a typo-detecting checksum, in groups of four.
public struct RecoveryKey: Sendable, Equatable {
    public let bytes: [UInt8]

    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    public init(bytes: [UInt8]) throws {
        guard bytes.count == 16 else { throw BackupError.invalidRecoveryKey }
        self.bytes = bytes
    }

    public static func generate() -> RecoveryKey {
        let key = SymmetricKey(size: .bits128)
        // swiftlint:disable:next force_try
        return try! RecoveryKey(bytes: key.withUnsafeBytes { Array($0) })
    }

    /// "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
    public var displayString: String {
        let chars = Array(RecoveryKey.encode(bytes) + RecoveryKey.checksum(bytes))
        return stride(from: 0, to: chars.count, by: 4).map { String(chars[$0..<min($0 + 4, chars.count)]) }.joined(separator: "-")
    }

    /// Parses user input. Accepts lowercase, spaces and dashes, and the Crockford
    /// substitutions O→0, I/L→1. Throws `.recoveryKeyTypo` when the checksum fails.
    public init(parsing input: String) throws {
        let cleaned = input.uppercased()
            .replacingOccurrences(of: "O", with: "0")
            .replacingOccurrences(of: "I", with: "1")
            .replacingOccurrences(of: "L", with: "1")
            .filter { !$0.isWhitespace && $0 != "-" }
        guard cleaned.count == 28, cleaned.allSatisfy({ RecoveryKey.alphabet.contains($0) }) else { throw BackupError.recoveryKeyTypo }
        let body = Array(cleaned.prefix(26))
        let check = String(cleaned.suffix(2))
        guard let bytes = RecoveryKey.decode(body) else { throw BackupError.recoveryKeyTypo }
        guard RecoveryKey.checksum(bytes) == check else { throw BackupError.recoveryKeyTypo }
        try self.init(bytes: bytes)
    }

    /// Non-secret identifier stored in archive headers ("made with the key ending ...").
    public var keyID: String {
        let mac = HMAC<SHA256>.authenticationCode(for: Data("LittleThings recovery key id v1".utf8), using: SymmetricKey(data: bytes))
        return Data(mac).prefix(4).map { String(format: "%02x", $0) }.joined()
    }

    func archiveKey(salt: Data) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: bytes), salt: salt, info: Data("LittleThings backup v1".utf8), outputByteCount: 32)
    }

    static func encode(_ bytes: [UInt8]) -> String {
        // 128 bits → 26 base32 symbols: a big-endian bit stream with two leading zero bits.
        var bits: [UInt8] = [0, 0]
        for byte in bytes { for i in (0..<8).reversed() { bits.append((byte >> UInt8(i)) & 1) } }
        var out = ""
        for chunk in stride(from: 0, to: bits.count, by: 5) {
            var v = 0
            for b in bits[chunk..<chunk + 5] { v = v << 1 | Int(b) }
            out.append(alphabet[v])
        }
        return out
    }

    static func decode(_ chars: [Character]) -> [UInt8]? {
        var bits: [UInt8] = []
        for c in chars {
            guard let v = alphabet.firstIndex(of: c) else { return nil }
            for i in (0..<5).reversed() { bits.append(UInt8((v >> i) & 1)) }
        }
        guard bits.count == 130, bits[0] == 0, bits[1] == 0 else { return nil }
        let payload = bits.dropFirst(2)
        var bytes: [UInt8] = []
        var index = payload.startIndex
        for _ in 0..<16 {
            var byte: UInt8 = 0
            for _ in 0..<8 { byte = byte << 1 | payload[index]; index += 1 }
            bytes.append(byte)
        }
        return bytes
    }

    static func checksum(_ bytes: [UInt8]) -> String {
        let digest = Array(SHA256.hash(data: Data(bytes)))
        let ten = (Int(digest[0]) << 2) | (Int(digest[1]) >> 6)
        return String([alphabet[(ten >> 5) & 31], alphabet[ten & 31]])
    }
}

public enum BackupError: Error, Equatable, Sendable {
    case invalidRecoveryKey
    case recoveryKeyTypo
    case notABackup
    case unsupportedFormat(Int)
    /// The archive was made with a different recovery key.
    case wrongRecoveryKey
    /// Authentication failed: the archive was modified or corrupted.
    case tamperedOrCorrupt
    case newerSchema(found: Int, supported: Int)
    case invalidReferences([String])
    case verificationFailed
}

/// Plaintext, authenticated header. Contains no relationship content.
public struct BackupHeader: Codable, Sendable, Equatable {
    public var formatVersion: Int
    public var schemaVersion: Int
    public var createdAt: Date
    public var appVersion: String
    public var kdf: String
    public var salt: Data
    public var recoveryKeyID: String
}

/// Encrypted body.
struct BackupPayload: Codable {
    var schemaVersion: Int
    var createdAt: Date
    var preferences: Preferences
    var people: [Person]
    var sources: [Source]
    var facts: [Fact]
    var importantDates: [ImportantDate]
    var interactions: [Interaction]
    var promises: [Promise]
    var calendarLinks: [CalendarLink]
    var gifts: [GiftIdea]
    var suggestions: [SuggestionRecord]
    var drafts: [Draft]
    var connections: [Connection]
    var captureRecords: [CaptureRecord]
    var lifeEvents: [LifeEvent]
    var trips: [Trip]
    var automationRules: [AutomationRule]
    var actionAttempts: [ActionAttempt]
    var attachments: [BackupAttachment]

    init(snapshot: VaultSnapshot, attachments: [BackupAttachment], schemaVersion: Int, createdAt: Date) {
        self.schemaVersion = schemaVersion
        self.createdAt = createdAt
        preferences = snapshot.preferences
        people = snapshot.people.values.sorted { $0.id < $1.id }
        sources = snapshot.sources.values.sorted { $0.id < $1.id }
        facts = snapshot.facts.values.sorted { $0.id < $1.id }
        importantDates = snapshot.importantDates.values.sorted { $0.id < $1.id }
        interactions = snapshot.interactions.values.sorted { $0.id < $1.id }
        promises = snapshot.promises.values.sorted { $0.id < $1.id }
        calendarLinks = snapshot.calendarLinks.values.sorted { $0.id < $1.id }
        gifts = snapshot.gifts.values.sorted { $0.id < $1.id }
        suggestions = snapshot.suggestions.values.sorted { $0.occurrenceKey < $1.occurrenceKey }
        drafts = snapshot.drafts.values.sorted { $0.id < $1.id }
        connections = snapshot.connections.values.sorted { $0.id < $1.id }
        captureRecords = snapshot.captureRecords.values.sorted { $0.id < $1.id }
        lifeEvents = snapshot.lifeEvents.values.sorted { $0.id < $1.id }
        trips = snapshot.trips.values.sorted { $0.id < $1.id }
        automationRules = snapshot.automationRules.values.sorted { $0.id < $1.id }
        actionAttempts = snapshot.actionAttempts.values.sorted { $0.id < $1.id }
        self.attachments = attachments
    }

    var snapshot: VaultSnapshot {
        var s = VaultSnapshot()
        s.preferences = preferences
        people.forEach { s.people[$0.id] = $0 }
        sources.forEach { s.sources[$0.id] = $0 }
        facts.forEach { s.facts[$0.id] = $0 }
        importantDates.forEach { s.importantDates[$0.id] = $0 }
        interactions.forEach { s.interactions[$0.id] = $0 }
        promises.forEach { s.promises[$0.id] = $0 }
        calendarLinks.forEach { s.calendarLinks[$0.id] = $0 }
        gifts.forEach { s.gifts[$0.id] = $0 }
        suggestions.forEach { s.suggestions[$0.occurrenceKey] = $0 }
        drafts.forEach { s.drafts[$0.id] = $0 }
        connections.forEach { s.connections[$0.id] = $0 }
        captureRecords.forEach { s.captureRecords[$0.id] = $0 }
        lifeEvents.forEach { s.lifeEvents[$0.id] = $0 }
        trips.forEach { s.trips[$0.id] = $0 }
        automationRules.forEach { s.automationRules[$0.id] = $0 }
        actionAttempts.forEach { s.actionAttempts[$0.id] = $0 }
        return s
    }
}

struct BackupAttachment: Codable, Equatable {
    var id: String
    var data: Data
}

/// What a valid archive contains, shown before the user confirms a restore.
public struct RestorePreview: Sendable, Equatable {
    public var header: BackupHeader
    public var people: Int
    public var notes: Int
    public var dates: Int
    public var promises: Int
    public var totalRecords: Int
    public var containsDemoData: Bool
}

/// Versioned, authenticated, encrypted backup archives (FR11).
///
/// Layout: `"LTBACKUP"` | u16 format version | u32 header length | header JSON | AES-256-GCM
/// combined box (nonce ‖ ciphertext ‖ tag). The header is authenticated as associated data.
/// The archive key comes from the user-held recovery key via HKDF with a per-archive salt;
/// the device-bound vault key is never part of an archive.
public enum BackupArchive {
    public static let magic = Data("LTBACKUP".utf8)
    public static let formatVersion = 1

    public static func make(snapshot: VaultSnapshot, attachments: [(id: String, data: Data)], recoveryKey: RecoveryKey, appVersion: String, now: Date, schemaVersion: Int = VaultSchema.currentVersion) throws -> Data {
        let salt = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        let header = BackupHeader(formatVersion: formatVersion, schemaVersion: schemaVersion, createdAt: now, appVersion: appVersion, kdf: "HKDF-SHA256", salt: salt, recoveryKeyID: recoveryKey.keyID)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let headerData = try encoder.encode(header)
        let payload = BackupPayload(snapshot: snapshot, attachments: attachments.map { BackupAttachment(id: $0.id, data: $0.data) }.sorted { $0.id < $1.id }, schemaVersion: schemaVersion, createdAt: now)
        let plaintext = try encoder.encode(payload)

        var prefix = magic
        prefix.append(contentsOf: [UInt8(formatVersion >> 8), UInt8(formatVersion & 0xFF)])
        let length = UInt32(headerData.count)
        prefix.append(contentsOf: [UInt8(length >> 24), UInt8((length >> 16) & 0xFF), UInt8((length >> 8) & 0xFF), UInt8(length & 0xFF)])
        prefix.append(headerData)
        let sealed = try AES.GCM.seal(plaintext, using: recoveryKey.archiveKey(salt: salt), authenticating: prefix)
        guard let combined = sealed.combined else { throw BackupError.tamperedOrCorrupt }
        return prefix + combined
    }

    public static func readHeader(_ archive: Data) throws -> (BackupHeader, prefix: Data, body: Data) {
        let bytes = [UInt8](archive)
        guard bytes.count > 14, Data(bytes[0..<8]) == magic else { throw BackupError.notABackup }
        let version = Int(bytes[8]) << 8 | Int(bytes[9])
        guard version == formatVersion else { throw BackupError.unsupportedFormat(version) }
        let length = Int(bytes[10]) << 24 | Int(bytes[11]) << 16 | Int(bytes[12]) << 8 | Int(bytes[13])
        guard length > 0, bytes.count > 14 + length + 28 else { throw BackupError.tamperedOrCorrupt }
        let headerData = Data(bytes[14..<(14 + length)])
        guard let header = try? JSONDecoder().decode(BackupHeader.self, from: headerData) else { throw BackupError.tamperedOrCorrupt }
        return (header, Data(bytes[0..<(14 + length)]), Data(bytes[(14 + length)...]))
    }

    /// Decrypts and fully validates an archive in memory without touching the vault.
    static func open(_ archive: Data, recoveryKey: RecoveryKey, supportedSchema: Int = VaultSchema.currentVersion) throws -> (BackupHeader, BackupPayload) {
        let (header, prefix, body) = try readHeader(archive)
        guard header.recoveryKeyID == recoveryKey.keyID else { throw BackupError.wrongRecoveryKey }
        let plaintext: Data
        do {
            let box = try AES.GCM.SealedBox(combined: body)
            plaintext = try AES.GCM.open(box, using: recoveryKey.archiveKey(salt: header.salt), authenticating: prefix)
        } catch {
            throw BackupError.tamperedOrCorrupt
        }
        if header.schemaVersion > supportedSchema { throw BackupError.newerSchema(found: header.schemaVersion, supported: supportedSchema) }
        guard let payload = try? JSONDecoder().decode(BackupPayload.self, from: plaintext) else { throw BackupError.tamperedOrCorrupt }
        if payload.schemaVersion > supportedSchema { throw BackupError.newerSchema(found: payload.schemaVersion, supported: supportedSchema) }
        let problems = payload.snapshot.referentialProblems()
        guard problems.isEmpty else { throw BackupError.invalidReferences(Array(Set(problems)).sorted()) }
        return (header, payload)
    }

    public static func preview(_ archive: Data, recoveryKey: RecoveryKey) throws -> RestorePreview {
        let (header, payload) = try open(archive, recoveryKey: recoveryKey)
        let snapshot = payload.snapshot
        return RestorePreview(header: header, people: snapshot.people.count, notes: snapshot.sources.count, dates: snapshot.importantDates.count, promises: snapshot.promises.count, totalRecords: snapshot.recordCount, containsDemoData: snapshot.containsDemoData)
    }

    /// Writes to a temporary sibling file and renames it into place, so an interrupted write
    /// never leaves a truncated archive at the destination.
    public static func writeAtomically(_ data: Data, to url: URL) throws {
        let partial = url.deletingLastPathComponent().appendingPathComponent(".\(url.lastPathComponent).partial-\(UUID().uuidString)")
        do {
            try data.write(to: partial)
            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
            try FileManager.default.moveItem(at: partial, to: url)
        } catch {
            try? FileManager.default.removeItem(at: partial)
            throw error
        }
    }
}

extension VaultStore {
    /// Builds an encrypted archive of everything in the vault.
    public func exportArchive(recoveryKey: RecoveryKey, appVersion: String, now: Date) throws -> Data {
        let snapshot = try loadSnapshot()
        var attachments: [(id: String, data: Data)] = []
        for id in try attachmentIDs() {
            if let data = try attachment(id: id) { attachments.append((id, data)) }
        }
        return try BackupArchive.make(snapshot: snapshot, attachments: attachments, recoveryKey: recoveryKey, appVersion: appVersion, now: now)
    }

    /// Restores an archive by building a complete, verified replacement vault in a staging file
    /// and atomically swapping it in. Any failure before the swap leaves the live vault
    /// untouched and open. If the final rename itself fails, the live file is unchanged but
    /// the live store has been closed; the caller reopens it with the same key.
    /// Merge restore is not supported.
    public static func restore(
        archive: Data,
        recoveryKey: RecoveryKey,
        replacing live: VaultStore,
        key: VaultKeyMaterial,
        fileProtection: VaultFileProtecting = NoFileProtection()
    ) async throws -> VaultStore {
        let (_, payload) = try BackupArchive.open(archive, recoveryKey: recoveryKey)
        let expected = payload.snapshot
        let liveURL = live.databaseURL
        let staged = liveURL.deletingLastPathComponent().appendingPathComponent("restore-staging-\(UUID().uuidString).ltdb")
        do {
            let stagingStore = try VaultStore(databaseURL: staged, key: key, fileProtection: fileProtection)
            try await stagingStore.apply(expected.allRecords.map { .upsert($0) } + [.setPreferences(expected.preferences)])
            for attachment in payload.attachments {
                try await stagingStore.putAttachment(attachment.data, id: attachment.id, createdAt: payload.createdAt)
            }
            try await stagingStore.verifyIntegrity()
            guard try await stagingStore.loadSnapshot() == expected else { throw BackupError.verificationFailed }
            await stagingStore.close()
        } catch {
            try? FileManager.default.removeItem(at: staged)
            throw error
        }
        await live.close()
        do {
            try VaultStore.atomicallyReplace(liveDatabase: liveURL, withStaged: staged)
        } catch {
            try? FileManager.default.removeItem(at: staged)
            throw error
        }
        return try VaultStore(databaseURL: liveURL, key: key, fileProtection: fileProtection)
    }
}
