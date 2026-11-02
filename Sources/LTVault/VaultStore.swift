import Foundation
import LTDomain

/// The encrypted local vault. All relationship data at rest lives in one SQLCipher file.
///
/// - Opening requires the 256-bit device-bound key; a wrong key fails closed.
/// - If SQLCipher is not linked (plain SQLite), opening fails rather than writing plaintext.
/// - `secure_delete` overwrites deleted content inside the file; `temp_store = MEMORY`
///   keeps temporary tables and indexes out of the file system.
public actor VaultStore {
    public nonisolated let databaseURL: URL
    private var connection: SQLiteConnection?
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()

    public init(
        databaseURL: URL,
        key: VaultKeyMaterial,
        fileProtection: VaultFileProtecting = NoFileProtection(),
        migrations: [VaultMigration] = VaultSchema.migrations
    ) throws {
        self.databaseURL = databaseURL
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        self.encoder = encoder
        self.connection = try VaultStore.openConnection(
            at: databaseURL, key: key, fileProtection: fileProtection, migrations: migrations
        )
    }

    // MARK: Opening and migration

    static func openConnection(
        at url: URL,
        key: VaultKeyMaterial,
        fileProtection: VaultFileProtecting,
        migrations: [VaultMigration]
    ) throws -> SQLiteConnection {
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try fileProtection.protectDirectory(directory)

        let connection: SQLiteConnection
        do {
            connection = try SQLiteConnection(path: url.path)
        } catch let error as SQLiteError {
            throw VaultError.storage(code: error.code, message: error.message)
        }
        do {
            try connection.execute("PRAGMA key = \(key.sqlCipherLiteral);")
            guard let version = try connection.scalarString("PRAGMA cipher_version"), !version.isEmpty else {
                throw VaultError.encryptionUnavailable
            }
            do {
                _ = try connection.query("SELECT count(*) FROM sqlite_master")
            } catch {
                throw VaultError.cannotDecrypt
            }
            try connection.execute("PRAGMA foreign_keys = ON")
            try connection.execute("PRAGMA secure_delete = ON")
            try connection.execute("PRAGMA temp_store = MEMORY")
            try connection.execute("PRAGMA journal_mode = DELETE")
            try migrate(connection, migrations: migrations)
            try fileProtection.protectFile(url)
            return connection
        } catch let error as VaultError {
            connection.close()
            throw error
        } catch let error as SQLiteError {
            connection.close()
            throw VaultError.storage(code: error.code, message: error.message)
        } catch {
            connection.close()
            throw error
        }
    }

    static func migrate(_ connection: SQLiteConnection, migrations: [VaultMigration]) throws {
        let current = Int(try connection.scalarInt("PRAGMA user_version") ?? 0)
        let latest = migrations.map(\.version).max() ?? 0
        if current > latest {
            throw VaultError.newerSchema(found: current, supported: latest)
        }
        for migration in migrations.sorted(by: { $0.version < $1.version }) where migration.version > current {
            try connection.execute("BEGIN IMMEDIATE")
            do {
                for statement in migration.statements {
                    try connection.execute(statement)
                }
                try connection.execute("PRAGMA user_version = \(migration.version)")
                try connection.execute("COMMIT")
            } catch {
                try? connection.execute("ROLLBACK")
                throw error
            }
        }
    }

    private func requireConnection() throws -> SQLiteConnection {
        guard let connection, connection.isOpen else { throw VaultError.closed }
        return connection
    }

    /// Closes the database and drops the in-process handle (used on lock and before restore).
    public func close() {
        connection?.close()
        connection = nil
    }

    public var isOpen: Bool { connection?.isOpen ?? false }

    public func schemaVersion() throws -> Int {
        Int(try requireConnection().scalarInt("PRAGMA user_version") ?? 0)
    }

    // MARK: Reading

    public func loadSnapshot() throws -> VaultSnapshot {
        let c = try requireConnection()
        var snapshot = VaultSnapshot()
        func bodies(_ table: String) throws -> [Data] {
            try c.query("SELECT body FROM \(table)").compactMap { $0.first?.dataValue }
        }
        func decode<T: Decodable>(_ type: T.Type, _ data: Data, _ table: String) throws -> T {
            do {
                return try decoder.decode(type, from: data)
            } catch {
                throw VaultError.decodingFailed(table: table)
            }
        }
        for d in try bodies("people") { let r = try decode(Person.self, d, "people"); snapshot.people[r.id] = r }
        for d in try bodies("sources") { let r = try decode(Source.self, d, "sources"); snapshot.sources[r.id] = r }
        for d in try bodies("facts") { let r = try decode(Fact.self, d, "facts"); snapshot.facts[r.id] = r }
        for d in try bodies("important_dates") { let r = try decode(ImportantDate.self, d, "important_dates"); snapshot.importantDates[r.id] = r }
        for d in try bodies("interactions") { let r = try decode(Interaction.self, d, "interactions"); snapshot.interactions[r.id] = r }
        for d in try bodies("promises") { let r = try decode(Promise.self, d, "promises"); snapshot.promises[r.id] = r }
        for d in try bodies("calendar_links") { let r = try decode(CalendarLink.self, d, "calendar_links"); snapshot.calendarLinks[r.id] = r }
        for d in try bodies("gifts") { let r = try decode(GiftIdea.self, d, "gifts"); snapshot.gifts[r.id] = r }
        for d in try bodies("suggestions") { let r = try decode(SuggestionRecord.self, d, "suggestions"); snapshot.suggestions[r.occurrenceKey] = r }
        for d in try bodies("drafts") { let r = try decode(Draft.self, d, "drafts"); snapshot.drafts[r.id] = r }
        for d in try bodies("connections") { let r = try decode(Connection.self, d, "connections"); snapshot.connections[r.id] = r }
        for d in try bodies("capture_records") { let r = try decode(CaptureRecord.self, d, "capture_records"); snapshot.captureRecords[r.id] = r }
        for d in try bodies("life_events") { let r = try decode(LifeEvent.self, d, "life_events"); snapshot.lifeEvents[r.id] = r }
        for d in try bodies("trips") { let r = try decode(Trip.self, d, "trips"); snapshot.trips[r.id] = r }
        for d in try bodies("automation_rules") { let r = try decode(AutomationRule.self, d, "automation_rules"); snapshot.automationRules[r.id] = r }
        for d in try bodies("action_attempts") { let r = try decode(ActionAttempt.self, d, "action_attempts"); snapshot.actionAttempts[r.id] = r }
        if let data = try c.query("SELECT body FROM preferences WHERE id = 1").first?.first?.dataValue {
            snapshot.preferences = try decode(Preferences.self, data, "preferences")
        }
        return snapshot
    }

    // MARK: Writing

    /// Applies changes atomically. Foreign keys are checked at commit; any violation rolls
    /// back the whole change set.
    public func apply(_ changes: [RecordChange]) throws {
        guard !changes.isEmpty else { return }
        let c = try requireConnection()
        try c.execute("BEGIN IMMEDIATE")
        do {
            try c.execute("PRAGMA defer_foreign_keys = ON")
            for change in changes {
                try write(change, to: c)
            }
            try c.execute("COMMIT")
        } catch let error as SQLiteError {
            try? c.execute("ROLLBACK")
            if error.code == 19 { // SQLITE_CONSTRAINT
                throw VaultError.integrityViolation(error.message)
            }
            throw VaultError.storage(code: error.code, message: error.message)
        } catch {
            try? c.execute("ROLLBACK")
            throw error
        }
    }

    private func write(_ change: RecordChange, to c: SQLiteConnection) throws {
        switch change {
        case .setPreferences(let preferences):
            try c.run(
                "INSERT INTO preferences (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body",
                [.blob(try encoder.encode(preferences))]
            )
        case .delete(let key):
            let (table, column, value) = VaultStore.location(of: key)
            try c.run("DELETE FROM \(table) WHERE \(column) = ?", [.text(value)])
        case .upsert(let record):
            try upsert(record, to: c)
        }
    }

    private func upsert(_ record: VaultRecord, to c: SQLiteConnection) throws {
        func optionalText(_ value: String?) -> SQLValue { value.map(SQLValue.text) ?? .null }
        switch record {
        case .person(let r):
            try put(c, "people", r.id.uuidString, [("updated_at", .real(r.updatedAt.timeIntervalSince1970)), ("is_archived", .integer(r.isArchived ? 1 : 0))], r)
        case .source(let r):
            try put(c, "sources", r.id.uuidString, [("kind", .text(r.kind.rawValue)), ("captured_at", .real(r.capturedAt.timeIntervalSince1970)), ("fingerprint", optionalText(r.fingerprint))], r)
            try link(c, "source_people", "source_id", r.id.uuidString, "person_id", r.personIDs.map(\.uuidString))
        case .fact(let r):
            try put(c, "facts", r.id.uuidString, [("person_id", .text(r.personID.uuidString)), ("source_id", optionalText(r.sourceID?.uuidString))], r)
        case .importantDate(let r):
            try put(c, "important_dates", r.id.uuidString, [("person_id", .text(r.personID.uuidString)), ("source_id", optionalText(r.sourceID?.uuidString))], r)
        case .interaction(let r):
            try put(c, "interactions", r.id.uuidString, [("occurred_at", .real(r.occurredAt.timeIntervalSince1970)), ("source_id", optionalText(r.sourceID?.uuidString))], r)
            try link(c, "interaction_people", "interaction_id", r.id.uuidString, "person_id", r.personIDs.map(\.uuidString))
        case .promise(let r):
            try put(c, "promises", r.id.uuidString, [("status", .text(r.status.rawValue)), ("source_id", optionalText(r.sourceID?.uuidString))], r)
            try link(c, "promise_people", "promise_id", r.id.uuidString, "person_id", r.personIDs.map(\.uuidString))
        case .calendarLink(let r):
            try put(c, "calendar_links", r.id.uuidString, [("event_identifier", .text(r.eventIdentifier))], r)
            try link(c, "calendar_link_people", "calendar_link_id", r.id.uuidString, "person_id", r.personIDs.map(\.uuidString))
        case .gift(let r):
            try put(c, "gifts", r.id.uuidString, [("person_id", .text(r.personID.uuidString)), ("occasion_date_id", optionalText(r.occasionDateID?.uuidString))], r)
        case .suggestion(let r):
            try put(c, "suggestions", r.occurrenceKey, [("id", .text(r.id.uuidString)), ("person_id", .text(r.personID.uuidString)), ("state", .text(r.state.rawValue))], r, keyColumn: "occurrence_key")
        case .draft(let r):
            try put(c, "drafts", r.id.uuidString, [("person_id", .text(r.personID.uuidString))], r)
        case .connection(let r):
            try put(c, "connections", r.id.uuidString, [("provider", .text(r.provider))], r)
        case .captureRecord(let r):
            try put(c, "capture_records", r.id.uuidString, [("provider", .text(r.provider)), ("fingerprint", .text(r.fingerprint)), ("source_id", optionalText(r.sourceID?.uuidString)), ("interaction_id", optionalText(r.interactionID?.uuidString))], r)
        case .lifeEvent(let r):
            try put(c, "life_events", r.id.uuidString, [("person_id", .text(r.personID.uuidString))], r)
            try link(c, "life_event_sources", "life_event_id", r.id.uuidString, "source_id", r.sourceIDs.map(\.uuidString))
        case .trip(let r):
            try put(c, "trips", r.id.uuidString, [], r)
        case .automationRule(let r):
            try put(c, "automation_rules", r.id.uuidString, [], r)
            try link(c, "automation_rule_people", "rule_id", r.id.uuidString, "person_id", Array(Set(r.recipients.map(\.personID.uuidString))))
        case .actionAttempt(let r):
            try put(c, "action_attempts", r.id.uuidString, [("idempotency_key", .text(r.idempotencyKey)), ("rule_id", optionalText(r.ruleID?.uuidString))], r)
        }
    }

    private func put<T: Encodable>(
        _ c: SQLiteConnection,
        _ table: String,
        _ key: String,
        _ columns: [(String, SQLValue)],
        _ body: T,
        keyColumn: String = "id"
    ) throws {
        let names = [keyColumn] + columns.map(\.0) + ["body"]
        let placeholders = Array(repeating: "?", count: names.count).joined(separator: ", ")
        let updates = names.dropFirst().map { "\($0) = excluded.\($0)" }.joined(separator: ", ")
        let sql = "INSERT INTO \(table) (\(names.joined(separator: ", "))) VALUES (\(placeholders)) ON CONFLICT(\(keyColumn)) DO UPDATE SET \(updates)"
        try c.run(sql, [.text(key)] + columns.map(\.1) + [.blob(try encoder.encode(body))])
    }

    private func link(_ c: SQLiteConnection, _ table: String, _ parentColumn: String, _ parentID: String, _ childColumn: String, _ childIDs: [String]) throws {
        try c.run("DELETE FROM \(table) WHERE \(parentColumn) = ?", [.text(parentID)])
        for child in Set(childIDs).sorted() {
            try c.run("INSERT INTO \(table) (\(parentColumn), \(childColumn)) VALUES (?, ?)", [.text(parentID), .text(child)])
        }
    }

    static func location(of key: RecordKey) -> (table: String, column: String, value: String) {
        switch key {
        case .person(let id): return ("people", "id", id.uuidString)
        case .source(let id): return ("sources", "id", id.uuidString)
        case .fact(let id): return ("facts", "id", id.uuidString)
        case .importantDate(let id): return ("important_dates", "id", id.uuidString)
        case .interaction(let id): return ("interactions", "id", id.uuidString)
        case .promise(let id): return ("promises", "id", id.uuidString)
        case .calendarLink(let id): return ("calendar_links", "id", id.uuidString)
        case .gift(let id): return ("gifts", "id", id.uuidString)
        case .suggestion(let key): return ("suggestions", "occurrence_key", key)
        case .draft(let id): return ("drafts", "id", id.uuidString)
        case .connection(let id): return ("connections", "id", id.uuidString)
        case .captureRecord(let id): return ("capture_records", "id", id.uuidString)
        case .lifeEvent(let id): return ("life_events", "id", id.uuidString)
        case .trip(let id): return ("trips", "id", id.uuidString)
        case .automationRule(let id): return ("automation_rules", "id", id.uuidString)
        case .actionAttempt(let id): return ("action_attempts", "id", id.uuidString)
        }
    }

    // MARK: Attachments (encrypted inside the vault file)

    public func putAttachment(_ data: Data, id: String, createdAt: Date) throws {
        try requireConnection().run(
            "INSERT INTO attachments (id, created_at, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            [.text(id), .real(createdAt.timeIntervalSince1970), .blob(data)]
        )
    }

    public func attachment(id: String) throws -> Data? {
        try requireConnection().query("SELECT data FROM attachments WHERE id = ?", [.text(id)]).first?.first?.dataValue
    }

    public func deleteAttachment(id: String) throws {
        try requireConnection().run("DELETE FROM attachments WHERE id = ?", [.text(id)])
    }

    public func attachmentIDs() throws -> [String] {
        try requireConnection().query("SELECT id FROM attachments ORDER BY id").compactMap { $0.first?.stringValue }
    }

    // MARK: Diagnostics (counts only; never contents)

    public func recordCounts() throws -> [String: Int] {
        let c = try requireConnection()
        var counts: [String: Int] = [:]
        for table in VaultSchema.recordTables {
            counts[table] = Int(try c.scalarInt("SELECT count(*) FROM \(table)") ?? 0)
        }
        return counts
    }

    /// Runs SQLite integrity and foreign-key checks.
    public func verifyIntegrity() throws {
        let c = try requireConnection()
        let integrity = try c.scalarString("PRAGMA integrity_check")
        guard integrity == "ok" else { throw VaultError.integrityViolation("integrity_check failed") }
        let violations = try c.query("PRAGMA foreign_key_check")
        guard violations.isEmpty else { throw VaultError.integrityViolation("\(violations.count) foreign key violations") }
    }

    // MARK: Files

    /// Removes the vault directory and everything in it. The caller must close stores first
    /// and separately destroy the key. Flash storage cannot be forensically erased; without
    /// the key the remaining ciphertext is unreadable.
    public static func destroyFiles(in directory: URL) throws {
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
    }

    /// Atomically replaces the live database file with a fully written, verified, closed
    /// staged file on the same volume (POSIX rename).
    public static func atomicallyReplace(liveDatabase: URL, withStaged staged: URL) throws {
        let journal = URL(fileURLWithPath: liveDatabase.path + "-journal")
        if FileManager.default.fileExists(atPath: journal.path) {
            // A leftover rollback journal would be applied to the new file; refuse.
            throw VaultError.integrityViolation("live database has an unfinished transaction")
        }
        guard rename(staged.path, liveDatabase.path) == 0 else {
            throw VaultError.storage(code: Int32(errno), message: "rename failed")
        }
    }
}
