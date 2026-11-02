import Foundation
import Testing
@testable import LTVault
import LTDomain
import LTTestSupport

@Suite("Encrypted backup and restore (FR11)")
struct BackupTests {
    let now = TestDates.fixtureNow

    func populatedStore(_ dir: TemporaryDirectory, key: VaultKeyMaterial = .generate()) async throws -> (VaultStore, VaultSnapshot) {
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("Vault/vault.ltdb"), key: key)
        var snapshot = SyntheticFixtures().snapshot
        snapshot.preferences = Preferences(onboardingCompleted: true, dailyCardLimit: 4)
        try await store.apply(snapshot.allRecords.map { .upsert($0) } + [.setPreferences(snapshot.preferences)])
        try await store.putAttachment(Data([1, 2, 3, 4]), id: "photo-1", createdAt: now)
        return (store, snapshot)
    }

    @Test func recoveryKeyEncodingAndTypoDetection() throws {
        for _ in 0..<50 {
            let key = RecoveryKey.generate()
            let display = key.displayString
            #expect(display.count == 34) // 28 symbols + 6 dashes
            #expect(try RecoveryKey(parsing: display) == key)
            #expect(try RecoveryKey(parsing: display.lowercased().replacingOccurrences(of: "-", with: " ")) == key)
        }
        let key = try RecoveryKey(bytes: Array(repeating: 0, count: 16))
        #expect(key.displayString.hasPrefix("0000-0000"))
        #expect(try RecoveryKey(parsing: key.displayString.replacingOccurrences(of: "0", with: "O")) == key)
        // Single-symbol substitutions in a fixed key are caught by the checksum. (A 10-bit
        // checksum misses about 1 in 1024 random substitutions, so this uses a fixed key.)
        let fixed = try RecoveryKey(bytes: Array(1...16))
        var caught = 0
        let display = Array(fixed.displayString)
        for index in display.indices where display[index] != "-" {
            var chars = display
            chars[index] = chars[index] == "Z" ? "Y" : "Z"
            if (try? RecoveryKey(parsing: String(chars))) == nil { caught += 1 }
        }
        #expect(caught == 28)
        #expect(throws: BackupError.recoveryKeyTypo) { try RecoveryKey(parsing: "too-short") }
    }

    @Test func exportAndRestoreRoundTripOnANewDevice() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let (store, snapshot) = try await populatedStore(dir)
        let recovery = RecoveryKey.generate()
        let archive = try await store.exportArchive(recoveryKey: recovery, appVersion: "1.0 (1)", now: now)

        let preview = try BackupArchive.preview(archive, recoveryKey: recovery)
        #expect(preview.people == snapshot.people.count)
        #expect(preview.totalRecords == snapshot.recordCount)
        #expect(preview.header.recoveryKeyID == recovery.keyID)

        // A different device has its own vault key and an empty vault.
        let otherDir = TemporaryDirectory(); defer { otherDir.cleanup() }
        let otherKey = VaultKeyMaterial.generate()
        let fresh = try VaultStore(databaseURL: otherDir.url.appendingPathComponent("Vault/vault.ltdb"), key: otherKey)
        let restored = try await VaultStore.restore(archive: archive, recoveryKey: recovery, replacing: fresh, key: otherKey)
        #expect(try await restored.loadSnapshot() == snapshot)
        #expect(try await restored.attachment(id: "photo-1") == Data([1, 2, 3, 4]))
        try await restored.verifyIntegrity()
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: otherDir.url.appendingPathComponent("Vault").path)
        #expect(leftovers == ["vault.ltdb"])
    }

    @Test func archiveNeverContainsPlaintextOrTheDeviceKey() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let key = VaultKeyMaterial.generate()
        let (store, _) = try await populatedStore(dir, key: key)
        let archive = try await store.exportArchive(recoveryKey: .generate(), appVersion: "1.0", now: now)
        #expect(archive.range(of: Data("Sam Rivera".utf8)) == nil)
        #expect(archive.range(of: Data("photographer".utf8)) == nil)
        #expect(archive.range(of: Data(key.bytes)) == nil)
        let hex = key.bytes.map { String(format: "%02X", $0) }.joined()
        #expect(archive.range(of: Data(hex.utf8)) == nil)
    }

    @Test func tamperingIsDetected() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let (store, _) = try await populatedStore(dir)
        let recovery = RecoveryKey.generate()
        let archive = try await store.exportArchive(recoveryKey: recovery, appVersion: "1.0", now: now)
        var body = archive
        body[body.count - 40] ^= 0x01
        #expect(throws: BackupError.tamperedOrCorrupt) { try BackupArchive.preview(body, recoveryKey: recovery) }
        // Editing the plaintext header (authenticated data) is also detected.
        let (_, prefix, _) = try BackupArchive.readHeader(archive)
        var header = archive
        if let range = header.range(of: Data("1.0".utf8), in: 0..<prefix.count) {
            header.replaceSubrange(range, with: Data("9.9".utf8))
        }
        #expect(throws: BackupError.tamperedOrCorrupt) { try BackupArchive.preview(header, recoveryKey: recovery) }
        #expect(throws: BackupError.tamperedOrCorrupt) { try BackupArchive.preview(archive.prefix(archive.count - 100), recoveryKey: recovery) }
        #expect(throws: BackupError.notABackup) { try BackupArchive.preview(Data("not a backup at all".utf8), recoveryKey: recovery) }
        var version = archive
        version[9] = 7
        #expect(throws: BackupError.unsupportedFormat(7)) { try BackupArchive.preview(version, recoveryKey: recovery) }
    }

    @Test func wrongRecoveryKeyIsRejected() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let (store, _) = try await populatedStore(dir)
        let archive = try await store.exportArchive(recoveryKey: .generate(), appVersion: "1.0", now: now)
        #expect(throws: BackupError.wrongRecoveryKey) { try BackupArchive.preview(archive, recoveryKey: .generate()) }
    }

    @Test func newerSchemaIsRefused() throws {
        let recovery = RecoveryKey.generate()
        let archive = try BackupArchive.make(snapshot: SyntheticFixtures().snapshot, attachments: [], recoveryKey: recovery, appVersion: "2.0", now: now, schemaVersion: VaultSchema.currentVersion + 1)
        #expect(throws: BackupError.newerSchema(found: VaultSchema.currentVersion + 1, supported: VaultSchema.currentVersion)) {
            try BackupArchive.preview(archive, recoveryKey: recovery)
        }
    }

    @Test func archivesWithBrokenReferencesAreRefused() throws {
        var snapshot = SyntheticFixtures().snapshot
        snapshot.people[SyntheticFixtures().alex] = nil // promise and note now point at nobody
        let recovery = RecoveryKey.generate()
        let archive = try BackupArchive.make(snapshot: snapshot, attachments: [], recoveryKey: recovery, appVersion: "1.0", now: now)
        #expect(throws: BackupError.self) { try BackupArchive.preview(archive, recoveryKey: recovery) }
    }

    @Test func failedRestoreLeavesCurrentVaultUntouched() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let key = VaultKeyMaterial.generate()
        let (store, snapshot) = try await populatedStore(dir, key: key)
        let recovery = RecoveryKey.generate()
        var archive = try await store.exportArchive(recoveryKey: recovery, appVersion: "1.0", now: now)
        archive[archive.count - 1] ^= 0xFF
        await #expect(throws: BackupError.tamperedOrCorrupt) {
            _ = try await VaultStore.restore(archive: archive, recoveryKey: recovery, replacing: store, key: key)
        }
        #expect(await store.isOpen)
        #expect(try await store.loadSnapshot() == snapshot)
        await #expect(throws: BackupError.wrongRecoveryKey) {
            _ = try await VaultStore.restore(archive: archive, recoveryKey: .generate(), replacing: store, key: key)
        }
        #expect(try await store.loadSnapshot() == snapshot)
        let files = try FileManager.default.contentsOfDirectory(atPath: dir.url.appendingPathComponent("Vault").path)
        #expect(files == ["vault.ltdb"])
    }

    @Test func restoreReplacesRatherThanMerges() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let key = VaultKeyMaterial.generate()
        let (store, snapshot) = try await populatedStore(dir, key: key)
        let recovery = RecoveryKey.generate()
        let archive = try await store.exportArchive(recoveryKey: recovery, appVersion: "1.0", now: now)
        let newer = Person(displayName: "Added after backup", createdAt: now)
        try await store.apply([.upsert(.person(newer))])
        let restored = try await VaultStore.restore(archive: archive, recoveryKey: recovery, replacing: store, key: key)
        let loaded = try await restored.loadSnapshot()
        #expect(loaded.people[newer.id] == nil)
        #expect(loaded == snapshot)
    }

    @Test func interruptedWritesNeverLeavePartialArchives() throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let target = dir.url.appendingPathComponent("missing-folder/backup.ltbackup")
        #expect(throws: (any Error).self) { try BackupArchive.writeAtomically(Data([1, 2, 3]), to: target) }
        #expect(!FileManager.default.fileExists(atPath: target.path))
        let ok = dir.url.appendingPathComponent("backup.ltbackup")
        try BackupArchive.writeAtomically(Data([1, 2, 3]), to: ok)
        try BackupArchive.writeAtomically(Data([4, 5]), to: ok)
        #expect(try Data(contentsOf: ok) == Data([4, 5]))
        #expect(try FileManager.default.contentsOfDirectory(atPath: dir.url.path) == ["backup.ltbackup"])
    }
}
