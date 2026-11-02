#if canImport(SQLCipher)
import SQLCipher
#else
import CSQLCipher
#endif
import Foundation

/// A value bound to or read from SQLite.
public enum SQLValue: Sendable, Equatable {
    case null
    case integer(Int64)
    case real(Double)
    case text(String)
    case blob(Data)

    public var stringValue: String? {
        if case .text(let s) = self { return s }
        return nil
    }

    public var int64Value: Int64? {
        if case .integer(let i) = self { return i }
        return nil
    }

    public var dataValue: Data? {
        switch self {
        case .blob(let d): return d
        case .text(let s): return Data(s.utf8)
        default: return nil
        }
    }
}

/// SQLite error. The message comes from SQLite and never includes bound values.
public struct SQLiteError: Error, CustomStringConvertible, Sendable {
    public let code: Int32
    public let message: String

    public var description: String { "SQLite error \(code): \(message)" }
}

/// A minimal, single-threaded wrapper over the SQLite C API as provided by SQLCipher.
/// Always used from inside the `VaultStore` actor.
final class SQLiteConnection {
    private var handle: OpaquePointer?

    init(path: String) throws {
        var db: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(path, &db, flags, nil)
        guard rc == SQLITE_OK, let db else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "open failed"
            if let db { sqlite3_close_v2(db) }
            throw SQLiteError(code: rc, message: message)
        }
        handle = db
    }

    deinit { close() }

    var isOpen: Bool { handle != nil }

    func close() {
        if let handle {
            sqlite3_close_v2(handle)
            self.handle = nil
        }
    }

    private func db() throws -> OpaquePointer {
        guard let handle else { throw SQLiteError(code: SQLITE_MISUSE, message: "connection closed") }
        return handle
    }

    private func error(_ rc: Int32) -> SQLiteError {
        let message = handle.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
        return SQLiteError(code: rc, message: message)
    }

    /// Executes one or more statements without bindings.
    func execute(_ sql: String) throws {
        let rc = sqlite3_exec(try db(), sql, nil, nil, nil)
        guard rc == SQLITE_OK else { throw error(rc) }
    }

    /// Runs a single statement with bindings, discarding any rows.
    func run(_ sql: String, _ bindings: [SQLValue] = []) throws {
        _ = try query(sql, bindings)
    }

    /// Runs a single statement and returns all rows.
    func query(_ sql: String, _ bindings: [SQLValue] = []) throws -> [[SQLValue]] {
        let db = try db()
        var statement: OpaquePointer?
        let rc = sqlite3_prepare_v2(db, sql, -1, &statement, nil)
        guard rc == SQLITE_OK, let statement else { throw error(rc) }
        defer { sqlite3_finalize(statement) }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (offset, value) in bindings.enumerated() {
            let index = Int32(offset + 1)
            let bindRC: Int32
            switch value {
            case .null:
                bindRC = sqlite3_bind_null(statement, index)
            case .integer(let i):
                bindRC = sqlite3_bind_int64(statement, index, i)
            case .real(let d):
                bindRC = sqlite3_bind_double(statement, index, d)
            case .text(let s):
                bindRC = sqlite3_bind_text(statement, index, s, -1, transient)
            case .blob(let data):
                bindRC = data.withUnsafeBytes { raw in
                    sqlite3_bind_blob(statement, index, raw.baseAddress, Int32(data.count), transient)
                }
            }
            guard bindRC == SQLITE_OK else { throw error(bindRC) }
        }

        var rows: [[SQLValue]] = []
        while true {
            let step = sqlite3_step(statement)
            if step == SQLITE_DONE { break }
            guard step == SQLITE_ROW else { throw error(step) }
            let columns = sqlite3_column_count(statement)
            var row: [SQLValue] = []
            row.reserveCapacity(Int(columns))
            for column in 0..<columns {
                switch sqlite3_column_type(statement, column) {
                case SQLITE_INTEGER:
                    row.append(.integer(sqlite3_column_int64(statement, column)))
                case SQLITE_FLOAT:
                    row.append(.real(sqlite3_column_double(statement, column)))
                case SQLITE_TEXT:
                    row.append(.text(String(cString: sqlite3_column_text(statement, column))))
                case SQLITE_BLOB:
                    let count = Int(sqlite3_column_bytes(statement, column))
                    if count == 0 {
                        row.append(.blob(Data()))
                    } else if let pointer = sqlite3_column_blob(statement, column) {
                        row.append(.blob(Data(bytes: pointer, count: count)))
                    } else {
                        row.append(.blob(Data()))
                    }
                default:
                    row.append(.null)
                }
            }
            rows.append(row)
        }
        return rows
    }

    func scalarString(_ sql: String) throws -> String? {
        try query(sql).first?.first?.stringValue
    }

    func scalarInt(_ sql: String) throws -> Int64? {
        try query(sql).first?.first?.int64Value
    }

    var changes: Int {
        handle.map { Int(sqlite3_changes($0)) } ?? 0
    }
}
