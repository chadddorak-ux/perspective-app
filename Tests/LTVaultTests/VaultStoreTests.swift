import Foundation
import Testing
@testable import LTVault
import LTDomain
import LTTestSupport

@Suite("Encrypted vault (Phase 1 gate)")
struct VaultStoreTests {
    @Test func recordsSurviveRestart() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("vault.ltdb")
        let key = VaultKeyMaterial.generate()
        let fixtures = SyntheticFixtures()

        let store = try VaultStore(databaseURL: url, key: key)
        try await store.apply(fixtures.snapshot.allRecords.map { .upsert($0) } + [.setPreferences(Preferences(onboardingCompleted: true, dailyCardLimit: 5))])
        await store.close()

        let reopened = try VaultStore(databaseURL: url, key: key)
        let loaded = try await reopened.loadSnapshot()
        var expected = fixtures.snapshot
        expected.preferences = Preferences(onboardingCompleted: true, dailyCardLimit: 5)
        #expect(loaded == expected)
        #expect(loaded.people[fixtures.sam]?.phoneNumbers.first?.value == "+1 (555) 010-0001")
        try await reopened.verifyIntegrity()
        #expect(try await reopened.schemaVersion() == VaultSchema.currentVersion)
    }

    @Test func databaseFileContainsNoPlaintext() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("vault.ltdb")
        let store = try VaultStore(databaseURL: url, key: .generate())
        let marker = "ZebraMarker\(UUID().uuidString.prefix(8))"
        let person = Person(displayName: marker, notes: "Secret note \(marker)", createdAt: Date())
        try await store.apply([.upsert(.person(person))])
        try await store.putAttachment(Data("attachment \(marker)".utf8), id: "a1", createdAt: Date())
        await store.close()

        let bytes = try Data(contentsOf: url)
        #expect(bytes.count > 0)
        #expect(!bytes.starts(with: Data("SQLite format 3".utf8)))
        #expect(bytes.range(of: Data(marker.utf8)) == nil)
        #expect(bytes.range(of: Data("displayName".utf8)) == nil)
        #expect(bytes.range(of: Data("CREATE TABLE".utf8)) == nil)
        // No side files left behind.
        let files = try FileManager.default.contentsOfDirectory(atPath: dir.url.path)
        #expect(files == ["vault.ltdb"])
    }

    @Test func wrongKeyFailsClosedAndLeavesDataIntact() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("vault.ltdb")
        let key = VaultKeyMaterial.generate()
        let store = try VaultStore(databaseURL: url, key: key)
        try await store.apply([.upsert(.person(Person(displayName: "Kept", createdAt: Date())))])
        await store.close()
        let before = try Data(contentsOf: url)

        #expect(throws: VaultError.cannotDecrypt) { try VaultStore(databaseURL: url, key: .generate()) }
        #expect(try Data(contentsOf: url) == before)

        let reopened = try VaultStore(databaseURL: url, key: key)
        #expect(try await reopened.loadSnapshot().people.count == 1)
    }

    @Test func orphanRecordsAreRejectedAtomically() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let person = Person(displayName: "Valid", createdAt: Date())
        let orphan = Fact(personID: PersonID(), category: .other, label: "x", value: "y", state: .confirmed, origin: .userAuthored, createdAt: Date())
        await #expect(throws: VaultError.self) {
            try await store.apply([.upsert(.person(person)), .upsert(.fact(orphan))])
        }
        // Nothing from the failed transaction persisted.
        #expect(try await store.loadSnapshot().people.isEmpty)
    }

    @Test func deferredForeignKeysAllowAnyOrderWithinTransaction() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let person = Person(displayName: "P", createdAt: Date())
        let fact = Fact(personID: person.id, category: .other, label: "x", value: "y", state: .confirmed, origin: .userAuthored, createdAt: Date())
        try await store.apply([.upsert(.fact(fact)), .upsert(.person(person))])
        #expect(try await store.loadSnapshot().facts.count == 1)
        // Deleting a person that still has facts must fail.
        await #expect(throws: VaultError.self) { try await store.apply([.delete(.person(person.id))]) }
        try await store.apply([.delete(.person(person.id)), .delete(.fact(fact.id))])
        #expect(try await store.loadSnapshot().people.isEmpty)
    }

    @Test func applyingDeletionPlansKeepsDatabaseConsistent() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let fixtures = SyntheticFixtures()
        try await store.apply(fixtures.snapshot.allRecords.map { .upsert($0) })

        let snapshot = try await store.loadSnapshot()
        let sourcePlan = DeletionPlanner.planSourceDeletion(fixtures.samNote, in: snapshot, now: Date())
        try await store.apply(sourcePlan.changes)
        let afterSource = try await store.loadSnapshot()
        let personPlan = DeletionPlanner.planPersonDeletion(fixtures.alex, in: afterSource, now: Date())
        try await store.apply(personPlan.changes)
        try await store.verifyIntegrity()

        var expected = snapshot
        expected.apply(sourcePlan.changes)
        expected.apply(personPlan.changes)
        #expect(try await store.loadSnapshot() == expected)
    }

    @Test func idempotencyKeysAreUniqueAtStorageLevel() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let a = ActionAttempt(kind: .sendMessage, idempotencyKey: "rule:1|2026-11-10", payloadDigest: "d", status: .submitted, createdAt: Date())
        let b = ActionAttempt(kind: .sendMessage, idempotencyKey: "rule:1|2026-11-10", payloadDigest: "d", status: .submitted, createdAt: Date())
        try await store.apply([.upsert(.actionAttempt(a))])
        await #expect(throws: VaultError.self) { try await store.apply([.upsert(.actionAttempt(b))]) }
        #expect(try await store.loadSnapshot().actionAttempts.count == 1)
    }

    @Test func captureFingerprintsAreUniquePerProvider() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let a = CaptureRecord(provider: "whatsapp-chat-export", fingerprint: "abc", capturedAt: Date())
        let b = CaptureRecord(provider: "whatsapp-chat-export", fingerprint: "abc", capturedAt: Date())
        let c = CaptureRecord(provider: "linkedin-export", fingerprint: "abc", capturedAt: Date())
        try await store.apply([.upsert(.captureRecord(a)), .upsert(.captureRecord(c))])
        await #expect(throws: VaultError.self) { try await store.apply([.upsert(.captureRecord(b))]) }
    }

    @Test func newerSchemaIsRefusedWithoutModification() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("v.ltdb")
        let key = VaultKeyMaterial.generate()
        let future = VaultSchema.migrations + [VaultMigration(version: 2, statements: ["CREATE TABLE future_feature (id TEXT)"])]
        let store = try VaultStore(databaseURL: url, key: key, migrations: future)
        await store.close()
        let before = try Data(contentsOf: url)
        #expect(throws: VaultError.newerSchema(found: 2, supported: 1)) { try VaultStore(databaseURL: url, key: key) }
        #expect(try Data(contentsOf: url) == before)
    }

    @Test func migrationPreservesExistingRecords() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("v.ltdb")
        let key = VaultKeyMaterial.generate()
        let store = try VaultStore(databaseURL: url, key: key)
        let fixtures = SyntheticFixtures()
        try await store.apply(fixtures.snapshot.allRecords.map { .upsert($0) })
        await store.close()

        let v2 = VaultSchema.migrations + [VaultMigration(version: 2, statements: [
            "CREATE INDEX people_archived ON people(is_archived)",
        ])]
        let upgraded = try VaultStore(databaseURL: url, key: key, migrations: v2)
        #expect(try await upgraded.schemaVersion() == 2)
        #expect(try await upgraded.loadSnapshot() == fixtures.snapshot)
    }

    @Test func failedMigrationRollsBack() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let url = dir.url.appendingPathComponent("v.ltdb")
        let key = VaultKeyMaterial.generate()
        _ = try VaultStore(databaseURL: url, key: key)
        let broken = VaultSchema.migrations + [VaultMigration(version: 2, statements: ["CREATE TABLE ok_table (id TEXT)", "THIS IS NOT SQL"])]
        #expect(throws: VaultError.self) { try VaultStore(databaseURL: url, key: key, migrations: broken) }
        let reopened = try VaultStore(databaseURL: url, key: key)
        #expect(try await reopened.schemaVersion() == 1)
    }

    @Test func attachmentsRoundTripAndDelete() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        let data = Data((0..<4096).map { UInt8($0 % 251) })
        try await store.putAttachment(data, id: "img-1", createdAt: Date())
        #expect(try await store.attachment(id: "img-1") == data)
        try await store.deleteAttachment(id: "img-1")
        #expect(try await store.attachment(id: "img-1") == nil)
    }

    @Test func closedStoreRefusesAccess() async throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let store = try VaultStore(databaseURL: dir.url.appendingPathComponent("v.ltdb"), key: .generate())
        await store.close()
        await #expect(throws: VaultError.closed) { try await store.loadSnapshot() }
    }

    @Test func destroyFilesRemovesVaultDirectory() throws {
        let dir = TemporaryDirectory(); defer { dir.cleanup() }
        let vaultDir = dir.url.appendingPathComponent("Vault")
        _ = try VaultStore(databaseURL: vaultDir.appendingPathComponent("v.ltdb"), key: .generate())
        try VaultStore.destroyFiles(in: vaultDir)
        #expect(!FileManager.default.fileExists(atPath: vaultDir.path))
    }

    @Test func keyMaterialValidation() {
        #expect(throws: VaultError.invalidKey) { try VaultKeyMaterial(bytes: [1, 2, 3]) }
        let a = VaultKeyMaterial.generate()
        let b = VaultKeyMaterial.generate()
        #expect(a != b)
        #expect(a.bytes.count == 32)
    }
}
