import Foundation

/// A forward-only schema migration applied inside a transaction.
public struct VaultMigration: Sendable {
    public let version: Int
    public let statements: [String]

    public init(version: Int, statements: [String]) {
        self.version = version
        self.statements = statements
    }
}

/// Hybrid schema: each record is stored as an encoded body plus the key columns needed for
/// foreign keys, uniqueness and dependency lookups. Link tables give explicit, enforced
/// references for many-to-many person relationships. All of it lives inside the SQLCipher
/// file, so bodies, indexes and link tables are encrypted at rest.
///
/// Foreign keys use NO ACTION semantics and are deferred to commit inside each write
/// transaction, so dependent records can be written in any order but a transaction can never
/// commit an orphan.
public enum VaultSchema {
    public static let currentVersion = 1

    public static let migrations: [VaultMigration] = [
        VaultMigration(version: 1, statements: [
            """
            CREATE TABLE people (
                id TEXT PRIMARY KEY NOT NULL,
                updated_at REAL NOT NULL,
                is_archived INTEGER NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE sources (
                id TEXT PRIMARY KEY NOT NULL,
                kind TEXT NOT NULL,
                captured_at REAL NOT NULL,
                fingerprint TEXT,
                body BLOB NOT NULL
            )
            """,
            "CREATE INDEX sources_fingerprint ON sources(fingerprint)",
            """
            CREATE TABLE source_people (
                source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
                person_id TEXT NOT NULL REFERENCES people(id),
                PRIMARY KEY (source_id, person_id)
            )
            """,
            "CREATE INDEX source_people_person ON source_people(person_id)",
            """
            CREATE TABLE facts (
                id TEXT PRIMARY KEY NOT NULL,
                person_id TEXT NOT NULL REFERENCES people(id),
                source_id TEXT REFERENCES sources(id),
                body BLOB NOT NULL
            )
            """,
            "CREATE INDEX facts_person ON facts(person_id)",
            "CREATE INDEX facts_source ON facts(source_id)",
            """
            CREATE TABLE important_dates (
                id TEXT PRIMARY KEY NOT NULL,
                person_id TEXT NOT NULL REFERENCES people(id),
                source_id TEXT REFERENCES sources(id),
                body BLOB NOT NULL
            )
            """,
            "CREATE INDEX important_dates_person ON important_dates(person_id)",
            "CREATE INDEX important_dates_source ON important_dates(source_id)",
            """
            CREATE TABLE interactions (
                id TEXT PRIMARY KEY NOT NULL,
                occurred_at REAL NOT NULL,
                source_id TEXT REFERENCES sources(id),
                body BLOB NOT NULL
            )
            """,
            "CREATE INDEX interactions_source ON interactions(source_id)",
            """
            CREATE TABLE interaction_people (
                interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
                person_id TEXT NOT NULL REFERENCES people(id),
                PRIMARY KEY (interaction_id, person_id)
            )
            """,
            "CREATE INDEX interaction_people_person ON interaction_people(person_id)",
            """
            CREATE TABLE promises (
                id TEXT PRIMARY KEY NOT NULL,
                status TEXT NOT NULL,
                source_id TEXT REFERENCES sources(id),
                body BLOB NOT NULL
            )
            """,
            "CREATE INDEX promises_source ON promises(source_id)",
            """
            CREATE TABLE promise_people (
                promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
                person_id TEXT NOT NULL REFERENCES people(id),
                PRIMARY KEY (promise_id, person_id)
            )
            """,
            "CREATE INDEX promise_people_person ON promise_people(person_id)",
            """
            CREATE TABLE calendar_links (
                id TEXT PRIMARY KEY NOT NULL,
                event_identifier TEXT NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE calendar_link_people (
                calendar_link_id TEXT NOT NULL REFERENCES calendar_links(id) ON DELETE CASCADE,
                person_id TEXT NOT NULL REFERENCES people(id),
                PRIMARY KEY (calendar_link_id, person_id)
            )
            """,
            """
            CREATE TABLE gifts (
                id TEXT PRIMARY KEY NOT NULL,
                person_id TEXT NOT NULL REFERENCES people(id),
                occasion_date_id TEXT REFERENCES important_dates(id),
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE suggestions (
                occurrence_key TEXT PRIMARY KEY NOT NULL,
                id TEXT NOT NULL UNIQUE,
                person_id TEXT NOT NULL REFERENCES people(id),
                state TEXT NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE drafts (
                id TEXT PRIMARY KEY NOT NULL,
                person_id TEXT NOT NULL REFERENCES people(id),
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE connections (
                id TEXT PRIMARY KEY NOT NULL,
                provider TEXT NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE capture_records (
                id TEXT PRIMARY KEY NOT NULL,
                provider TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                source_id TEXT REFERENCES sources(id),
                interaction_id TEXT REFERENCES interactions(id),
                body BLOB NOT NULL,
                UNIQUE (provider, fingerprint)
            )
            """,
            """
            CREATE TABLE life_events (
                id TEXT PRIMARY KEY NOT NULL,
                person_id TEXT NOT NULL REFERENCES people(id),
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE life_event_sources (
                life_event_id TEXT NOT NULL REFERENCES life_events(id) ON DELETE CASCADE,
                source_id TEXT NOT NULL REFERENCES sources(id),
                PRIMARY KEY (life_event_id, source_id)
            )
            """,
            """
            CREATE TABLE trips (
                id TEXT PRIMARY KEY NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE automation_rules (
                id TEXT PRIMARY KEY NOT NULL,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE automation_rule_people (
                rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
                person_id TEXT NOT NULL REFERENCES people(id),
                PRIMARY KEY (rule_id, person_id)
            )
            """,
            """
            CREATE TABLE action_attempts (
                id TEXT PRIMARY KEY NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                rule_id TEXT,
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE preferences (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                body BLOB NOT NULL
            )
            """,
            """
            CREATE TABLE attachments (
                id TEXT PRIMARY KEY NOT NULL,
                created_at REAL NOT NULL,
                data BLOB NOT NULL
            )
            """,
        ]),
    ]

    /// Tables holding records, in a stable order (used for counts and diagnostics).
    public static let recordTables = [
        "people", "sources", "facts", "important_dates", "interactions", "promises",
        "calendar_links", "gifts", "suggestions", "drafts", "connections", "capture_records",
        "life_events", "trips", "automation_rules", "action_attempts",
    ]
}
