import Foundation
import LTCryptoSupport
import LTDomain
import LTIntelligence

// MARK: - WhatsApp "Export chat" text (user-initiated, per chat)

public struct ChatMessage: Hashable, Sendable {
    public var timestamp: Date
    public var sender: String
    public var text: String
}

public struct ParsedChat: Sendable, Hashable {
    public var participants: [String]
    public var messages: [ChatMessage]
    /// True when every date could be read either day-first or month-first.
    public var dateOrderAmbiguous: Bool
    public var dayFirst: Bool

    public var isGroup: Bool { participants.count > 2 }
    public var firstMessage: Date? { messages.first?.timestamp }
    public var lastMessage: Date? { messages.last?.timestamp }
}

/// Parses the text file produced by WhatsApp's per-chat "Export chat". Format details come
/// from public exports and vary by platform and locale; the capability matrix records this
/// route as a prototype that still needs verification against fresh exports.
public enum WhatsAppChatParser {
    // [1/2/24, 9:41:05 PM] Name: text      (iOS)
    // 1/2/24, 21:41 - Name: text            (Android)
    static let iosPattern = #"^\[(\d{1,4})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]\s+([^:]{1,80}?):\s?(.*)$"#
    static let androidPattern = #"^(\d{1,4})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\s+-\s+([^:]{1,80}?):\s?(.*)$"#

    static func clean(_ line: String) -> String {
        line.replacingOccurrences(of: "\u{200E}", with: "")
            .replacingOccurrences(of: "\u{200F}", with: "")
            .replacingOccurrences(of: "\u{202F}", with: " ")
            .replacingOccurrences(of: "\u{00A0}", with: " ")
    }

    static let systemNotices = [
        "end-to-end encrypted", "security code changed", "created group", "changed the subject",
        "changed this group", "changed the group", "joined using this group", "missed voice call", "missed video call",
        "this message was deleted", "you deleted this message",
    ]

    static func isSystemNotice(_ text: String) -> Bool {
        let lower = text.lowercased()
        return systemNotices.contains { lower.contains($0) }
    }

    public static func looksLikeExport(_ text: String) -> Bool {
        let lines = text.split(whereSeparator: \.isNewline).prefix(20).map { clean(String($0)) }
        return lines.contains { !regexGroups(iosPattern, $0).isEmpty || !regexGroups(androidPattern, $0).isEmpty }
    }

    /// - Parameters:
    ///   - timeZone: timestamps in exports are local wall-clock times without an offset.
    ///   - preferDayFirst: used only when the data itself cannot disambiguate.
    public static func parse(_ text: String, timeZone: TimeZone, preferDayFirst: Bool = false) -> ParsedChat {
        struct RawLine { var a: Int; var b: Int; var year: Int; var hour: Int; var minute: Int; var second: Int; var meridiem: String; var sender: String; var text: String }
        var raws: [RawLine] = []
        for rawLine in text.components(separatedBy: .newlines) {
            let line = clean(rawLine)
            let groups = regexGroups(iosPattern, line).isEmpty ? regexGroups(androidPattern, line) : regexGroups(iosPattern, line)
            if groups.isEmpty {
                // Continuation of a multi-line message.
                if !raws.isEmpty, !line.trimmed.isEmpty { raws[raws.count - 1].text += "\n" + line }
                continue
            }
            guard var a = Int(groups[1]), var b = Int(groups[2]), var year = Int(groups[3]),
                  let hour = Int(groups[4]), let minute = Int(groups[5]) else { continue }
            if a > 31 { // year-first (yyyy-mm-dd): normalize to (month, day, year)
                (a, b, year) = (b, year, a)
            } else if year < 100 {
                year += 2000
            }
            raws.append(RawLine(a: a, b: b, year: year, hour: hour, minute: minute, second: Int(groups[6]) ?? 0, meridiem: groups[7], sender: groups[8].trimmed, text: groups[9]))
        }
        let firstOver12 = raws.contains { $0.a > 12 }
        let secondOver12 = raws.contains { $0.b > 12 }
        let dayFirst = firstOver12 ? true : (secondOver12 ? false : preferDayFirst)
        let ambiguous = !firstOver12 && !secondOver12 && raws.contains { $0.a != $0.b }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        var messages: [ChatMessage] = []
        for r in raws {
            var hour = r.hour
            let meridiem = r.meridiem.lowercased().filter(\.isLetter)
            if meridiem == "pm" && hour < 12 { hour += 12 }
            if meridiem == "am" && hour == 12 { hour = 0 }
            let (month, day) = dayFirst ? (r.b, r.a) : (r.a, r.b)
            guard CalendarDay(year: r.year, month: month, day: day) != nil,
                  let date = calendar.date(from: DateComponents(year: r.year, month: month, day: day, hour: hour, minute: r.minute, second: r.second)) else { continue }
            let body = r.text.trimmed
            if WhatsAppChatParser.isSystemNotice(body) { continue }
            // Omitted media is activity but carries no conversational text.
            let isMediaPlaceholder = body.hasPrefix("<attached:") || body.hasSuffix("omitted") || body == "<Media omitted>"
            messages.append(ChatMessage(timestamp: date, sender: r.sender, text: isMediaPlaceholder ? "" : body))
        }
        messages.sort { $0.timestamp < $1.timestamp }
        var participants: [String] = []
        for m in messages where !participants.contains(m.sender) { participants.append(m.sender) }
        return ParsedChat(participants: participants, messages: messages, dateOrderAmbiguous: ambiguous, dayFirst: dayFirst)
    }
}

// MARK: - LinkedIn data archive: Connections.csv

public struct LinkedInConnection: Hashable, Sendable {
    public var firstName: String
    public var lastName: String
    public var profileURL: String
    public var email: String
    public var company: String
    public var position: String
    public var connectedOn: String

    public var fullName: String { [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ") }
    public var rowText: String { "\(fullName) — \(position) at \(company)" }
}

public enum LinkedInConnectionsParser {
    public static func parse(_ text: String) -> [LinkedInConnection] {
        let rows = CSV.parse(text)
        guard let headerIndex = rows.firstIndex(where: { $0.first?.trimmed == "First Name" }) else { return [] }
        let header = rows[headerIndex].map(\.trimmed)
        func column(_ name: String) -> Int? { header.firstIndex(of: name) }
        let first = column("First Name"), last = column("Last Name"), url = column("URL"), email = column("Email Address")
        let company = column("Company"), position = column("Position"), connected = column("Connected On")
        func value(_ row: [String], _ index: Int?) -> String {
            guard let index, index < row.count else { return "" }
            return row[index].trimmed
        }
        return rows[(headerIndex + 1)...].compactMap { row in
            guard row.count > 1 else { return nil }
            let c = LinkedInConnection(firstName: value(row, first), lastName: value(row, last), profileURL: value(row, url), email: value(row, email), company: value(row, company), position: value(row, position), connectedOn: value(row, connected))
            return c.fullName.isEmpty ? nil : c
        }
    }
}

/// Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF).
public enum CSV {
    public static func parse(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        var iterator = Array(text.replacingOccurrences(of: "\r\n", with: "\n")).makeIterator()
        var pending: Character? = nil
        while let c = pending ?? iterator.next() {
            pending = nil
            if inQuotes {
                if c == "\"" {
                    if let next = iterator.next() {
                        if next == "\"" { field.append("\"") } else { inQuotes = false; pending = next }
                    } else { inQuotes = false }
                } else { field.append(c) }
            } else {
                switch c {
                case "\"": inQuotes = true
                case ",": row.append(field); field = ""
                case "\n": row.append(field); rows.append(row); row = []; field = ""
                default: field.append(c)
                }
            }
        }
        if !field.isEmpty || !row.isEmpty { row.append(field); rows.append(row) }
        return rows
    }
}

// MARK: - Import preview and planning (FR12)

public struct ImportPreview: Sendable, Hashable {
    public var format: ImportFormat
    public var formatDescription: String
    public var participants: [String]
    public var dateRange: ClosedRange<Date>?
    public var itemCount: Int
    public var newRecords: Int
    public var duplicateRecords: Int
    public var estimatedStorageBytes: Int
    public var warnings: [String]
}

public struct ImportPlan: Sendable {
    public var preview: ImportPreview
    public var changes: [RecordChange]
}

/// Plans user-initiated imports. Nothing is saved until the user reviews the preview and
/// confirms; re-importing the same material adds nothing (fingerprints).
public enum ImportPlanner {
    /// WhatsApp chat export → one source (the transcript), one observed interaction per active
    /// day, and a manual-import connection whose coverage is the export's date range for the
    /// mapped person. This is a one-off import, not monitoring.
    public static func planWhatsApp(
        _ chat: ParsedChat,
        selfName: String,
        mapping: [String: PersonID],
        in snapshot: VaultSnapshot,
        importedAt now: Date,
        timeZone: TimeZone
    ) -> ImportPlan {
        let provider = ImportFormat.whatsAppChat.rawValue
        let others = chat.participants.filter { $0 != selfName }
        let chatKey = digest(provider + "|" + chat.participants.sorted().joined(separator: "|"))
        let mappedPeople = others.compactMap { mapping[$0] }
        var warnings: [String] = []
        if chat.dateOrderAmbiguous { warnings.append("Dates in this export could be day-first or month-first. Check the date range before importing.") }
        if chat.isGroup { warnings.append("This is a group chat. It won't count as one-to-one conversation for check-in rhythm.") }
        if mappedPeople.count < others.count { warnings.append("Some participants aren't matched to people and will be skipped.") }

        // One interaction per local day with at least one message (media counts as activity).
        var byDay: [CalendarDay: Date] = [:]
        for message in chat.messages {
            let day = CalendarDay(date: message.timestamp, timeZone: timeZone)
            byDay[day] = min(byDay[day] ?? message.timestamp, message.timestamp)
        }
        let existing = Set(snapshot.captureRecords.values.filter { $0.provider == provider }.map(\.fingerprint))
        var changes: [RecordChange] = []
        var newCount = 0
        var duplicateCount = 0
        let transcript = chat.messages.filter { !$0.text.isEmpty }.map { "\($0.sender): \($0.text)" }.joined(separator: "\n")
        let transcriptFingerprint = CapturePipeline.fingerprint(provider: provider, content: chatKey + transcript)

        let existingConnection = snapshot.connections.values.first { $0.provider == provider && $0.scopeDescription.hasSuffix(chatKey.prefix(12)) }
        var connection = existingConnection ?? Connection(
            provider: provider,
            displayName: "WhatsApp chat export",
            scopeDescription: "One exported chat · \(chatKey.prefix(12))",
            isManualImport: true,
            createdAt: now
        )
        let source = Source(
            kind: .fileImport,
            provider: provider,
            title: "WhatsApp chat (exported \(CalendarDay(date: now, timeZone: timeZone).isoString))",
            capturedAt: now,
            text: transcript,
            personIDs: mappedPeople,
            fingerprint: transcriptFingerprint
        )
        let transcriptIsNew = !existing.contains(transcriptFingerprint) && !mappedPeople.isEmpty
        if transcriptIsNew {
            changes.append(.upsert(.source(source)))
            changes.append(.upsert(.captureRecord(CaptureRecord(provider: provider, fingerprint: transcriptFingerprint, sourceID: source.id, personIDs: mappedPeople, extractionState: .pending, capturedAt: now))))
        }
        if !mappedPeople.isEmpty {
            for (day, first) in byDay.sorted(by: { $0.key < $1.key }) {
                let fp = digest("\(chatKey)|\(day.isoString)")
                if existing.contains(fp) { duplicateCount += 1; continue }
                newCount += 1
                let interaction = Interaction(
                    personIDs: mappedPeople,
                    kind: .message,
                    occurredAt: first,
                    confirmation: .sourceObserved,
                    channel: connection.id.uuidString,
                    isGroup: chat.isGroup,
                    sourceID: transcriptIsNew ? source.id : nil,
                    createdAt: now
                )
                changes.append(.upsert(.interaction(interaction)))
                changes.append(.upsert(.captureRecord(CaptureRecord(provider: provider, fingerprint: fp, interactionID: interaction.id, personIDs: mappedPeople, extractionState: .skipped, capturedAt: now))))
            }
            if let first = chat.firstMessage {
                connection.coverage.append(CoverageInterval(start: first, end: now, personIDs: mappedPeople))
                connection.coverage = mergeCoverage(connection.coverage)
            }
            connection.lastSuccessfulRefresh = now
            connection.state = .connected
            changes.insert(.upsert(.connection(connection)), at: 0)
        }
        let range: ClosedRange<Date>? = chat.firstMessage.flatMap { f in chat.lastMessage.map { f...$0 } }
        let preview = ImportPreview(
            format: .whatsAppChat,
            formatDescription: "WhatsApp chat export (\(chat.dayFirst ? "day-first" : "month-first") dates)",
            participants: chat.participants,
            dateRange: range,
            itemCount: chat.messages.count,
            newRecords: newCount + (transcriptIsNew ? 1 : 0),
            duplicateRecords: duplicateCount + (transcriptIsNew || mappedPeople.isEmpty ? 0 : 1),
            estimatedStorageBytes: transcriptIsNew ? transcript.utf8.count + newCount * 400 : newCount * 400,
            warnings: warnings
        )
        return ImportPlan(preview: preview, changes: changes)
    }

    /// LinkedIn Connections.csv → stores only rows the user mapped to people (never the whole
    /// network). A changed company/position versus the previous import becomes an unconfirmed
    /// life-update candidate with no date (the export has none), so it never alerts on its own.
    public static func planLinkedIn(
        _ connections: [LinkedInConnection],
        mapping: [String: PersonID],
        in snapshot: VaultSnapshot,
        importedAt now: Date
    ) -> ImportPlan {
        let provider = ImportFormat.linkedInConnections.rawValue
        let mapped = connections.filter { mapping[$0.fullName] != nil }.sorted { $0.fullName < $1.fullName }
        let existing = Set(snapshot.captureRecords.values.filter { $0.provider == provider }.map(\.fingerprint))
        var changes: [RecordChange] = []
        var newCount = 0
        var duplicates = 0
        var rowsText: [String] = []
        var pending: [(LinkedInConnection, PersonID, String)] = []
        for row in mapped {
            guard let personID = mapping[row.fullName] else { continue }
            let fp = digest("\(row.profileURL.isEmpty ? row.fullName : row.profileURL)|\(row.company)|\(row.position)")
            if existing.contains(fp) { duplicates += 1; continue }
            pending.append((row, personID, fp))
            rowsText.append(row.rowText)
        }
        guard !pending.isEmpty else {
            return ImportPlan(preview: ImportPreview(format: .linkedInConnections, formatDescription: "LinkedIn Connections.csv", participants: mapped.map(\.fullName), dateRange: nil, itemCount: connections.count, newRecords: 0, duplicateRecords: duplicates, estimatedStorageBytes: 0, warnings: []), changes: [])
        }
        let source = Source(kind: .fileImport, provider: provider, title: "LinkedIn export", capturedAt: now, text: rowsText.joined(separator: "\n"), personIDs: Array(Set(pending.map(\.1))).sorted())
        changes.append(.upsert(.source(source)))
        for (row, personID, fp) in pending {
            newCount += 1
            let previous = snapshot.facts.values
                .filter { $0.personID == personID && $0.category == .work && $0.label == "Role (LinkedIn)" }
                .max { $0.createdAt < $1.createdAt }
            let role = "\(row.position) at \(row.company)"
            changes.append(.upsert(.fact(Fact(personID: personID, category: .work, label: "Role (LinkedIn)", value: role, sourceID: source.id, excerpt: row.rowText, state: .unconfirmed, origin: .imported, createdAt: now))))
            if let previous, previous.value != role {
                changes.append(.upsert(.lifeEvent(LifeEvent(
                    personID: personID, category: .newJob,
                    summary: "LinkedIn shows a new role: \(role) (previously \(previous.value))",
                    sourceIDs: [source.id], excerpt: row.rowText, eventDay: nil, capturedAt: now,
                    explicitness: .explicit, confirmation: .unconfirmed, createdAt: now
                ))))
            }
            changes.append(.upsert(.captureRecord(CaptureRecord(provider: provider, providerRecordID: row.profileURL.nilIfBlank, fingerprint: fp, sourceID: source.id, personIDs: [personID], extractionState: .reviewed, capturedAt: now))))
        }
        let preview = ImportPreview(
            format: .linkedInConnections,
            formatDescription: "LinkedIn Connections.csv (only the \(pending.count) matched row\(pending.count == 1 ? "" : "s") are stored)",
            participants: mapped.map(\.fullName),
            dateRange: nil,
            itemCount: connections.count,
            newRecords: newCount,
            duplicateRecords: duplicates,
            estimatedStorageBytes: source.text.utf8.count + newCount * 300,
            warnings: ["LinkedIn exports don't include start dates, so role changes are shown for review without a date."]
        )
        return ImportPlan(preview: preview, changes: changes)
    }

    /// Suggests participant → person matches. Only unambiguous matches are pre-selected.
    public static func suggestedMapping(for names: [String], people: [Person]) -> [String: PersonID] {
        let hints = people.filter { !$0.isArchived }.map(PersonHint.init(person:))
        var result: [String: PersonID] = [:]
        for name in names {
            if case .resolved(let id) = IdentityMatcher.resolve(name, among: hints, linkedPeople: []) {
                // Require a full-name match for pre-selection; first-name-only stays manual.
                let full = ContactNormalizer.normalizeName(name)
                if hints.first(where: { $0.id == id })?.names.contains(where: { ContactNormalizer.normalizeName($0) == full }) == true {
                    result[name] = id
                }
            }
        }
        return result
    }

    /// Revoking an import source: stop future capture and optionally delete what it added.
    public static func planRevocation(of connectionID: ConnectionID, deleteImported: Bool, in snapshot: VaultSnapshot, now: Date) -> [RecordChange] {
        guard var connection = snapshot.connections[connectionID] else { return [] }
        var changes: [RecordChange] = []
        if deleteImported {
            var working = snapshot
            let interactions = snapshot.interactions.values.filter { $0.channel == connectionID.uuidString }.sorted { $0.id < $1.id }
            let sourceIDs = Set(interactions.compactMap(\.sourceID))
            for interaction in interactions {
                for record in working.captureRecords.values where record.interactionID == interaction.id {
                    changes.append(.delete(.captureRecord(record.id)))
                    working.apply(.delete(.captureRecord(record.id)))
                }
                changes.append(.delete(.interaction(interaction.id)))
                working.apply(.delete(.interaction(interaction.id)))
            }
            for sourceID in sourceIDs.sorted() {
                let plan = DeletionPlanner.planSourceDeletion(sourceID, in: working, now: now)
                changes += plan.changes
                working.apply(plan.changes)
            }
            changes.append(.delete(.connection(connectionID)))
        } else {
            connection.state = .revoked
            changes.append(.upsert(.connection(connection)))
        }
        return changes
    }

    static func mergeCoverage(_ intervals: [CoverageInterval]) -> [CoverageInterval] {
        let sorted = intervals.sorted { $0.start < $1.start }
        var merged: [CoverageInterval] = []
        for interval in sorted {
            if var last = merged.last, last.personIDs.map(Set.init) == interval.personIDs.map(Set.init), interval.start <= last.end {
                last.end = max(last.end, interval.end)
                merged[merged.count - 1] = last
            } else {
                merged.append(interval)
            }
        }
        return merged
    }

    static func digest(_ string: String) -> String {
        SHA256.hash(data: Data(string.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

func regexGroups(_ pattern: String, _ text: String) -> [String] {
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) else { return [] }
    let ns = text as NSString
    return (0..<match.numberOfRanges).map { i in
        let r = match.range(at: i)
        return r.location == NSNotFound ? "" : ns.substring(with: r)
    }
}
