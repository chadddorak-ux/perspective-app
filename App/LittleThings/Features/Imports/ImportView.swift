import LTAppCore
import LTCapture
import LTDomain
import SwiftUI
import UniformTypeIdentifiers

/// User-initiated import of a WhatsApp chat export or LinkedIn Connections.csv. Parsing happens
/// on this iPhone. Nothing is saved until the preview is confirmed. This is a one-off import,
/// not monitoring.
struct ImportView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var picking = false
    @State private var text: String?
    @State private var format: ImportFormat?
    @State private var participants: [String] = []
    @State private var selfName = ""
    @State private var mapping: [String: PersonID] = [:]
    @State private var dayFirst = false
    @State private var message: String?

    var body: some View {
        Form {
            Section {
                Button("Choose a file") { picking = true }
            } footer: {
                Text("In WhatsApp, open a chat › Export chat › Without media, then save or share it to LittleThings. For LinkedIn, request your data archive and choose Connections.csv. Only the people you match are stored.")
            }
            if let format, let plan = currentPlan() {
                Section("Who's who") {
                    if format == .whatsAppChat {
                        Picker("Which one is you?", selection: $selfName) {
                            Text("Choose…").tag("")
                            ForEach(participants, id: \.self) { Text($0).tag($0) }
                        }
                        Toggle("Dates are day-first (e.g. 13/09)", isOn: $dayFirst)
                    }
                    ForEach(participants.filter { $0 != selfName }, id: \.self) { name in
                        Picker(name, selection: Binding(get: { mapping[name] }, set: { mapping[name] = $0 })) {
                            Text("Skip").tag(PersonID?.none)
                            ForEach(model.snapshot.activePeople) { Text($0.name).tag(Optional($0.id)) }
                        }
                    }
                }
                Section("Preview") {
                    LabeledContent("Format", value: plan.preview.formatDescription)
                    if let range = plan.preview.dateRange {
                        LabeledContent("Dates", value: "\(range.lowerBound.formatted(.dateTime.month().day().year())) – \(range.upperBound.formatted(.dateTime.month().day().year()))")
                    }
                    LabeledContent("Items in file", value: "\(plan.preview.itemCount)")
                    LabeledContent("New records", value: "\(plan.preview.newRecords)")
                    LabeledContent("Already imported", value: "\(plan.preview.duplicateRecords)")
                    LabeledContent("Storage", value: ByteCountFormatter.string(fromByteCount: Int64(plan.preview.estimatedStorageBytes), countStyle: .file))
                    ForEach(plan.preview.warnings, id: \.self) { Text($0).font(.caption).foregroundStyle(.orange) }
                    Button("Import") {
                        Task {
                            do { try await model.commitImport(plan); dismiss() } catch { message = "The import couldn't be saved." }
                        }
                    }
                    .disabled(plan.changes.isEmpty || (format == .whatsAppChat && selfName.isEmpty))
                }
            }
            if let message { Section { Text(message).foregroundStyle(.orange) } }
        }
        .navigationTitle("Import")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        .fileImporter(isPresented: $picking, allowedContentTypes: [.plainText, .commaSeparatedText, .text]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url), let string = String(data: data, encoding: .utf8) else { message = "That file couldn't be read."; return }
            guard let detected = ImportFormat.detect(fileName: url.lastPathComponent, data: data) else { message = "That doesn't look like a WhatsApp chat export or LinkedIn Connections.csv."; return }
            text = string
            format = detected
            if detected == .whatsAppChat {
                participants = WhatsAppChatParser.parse(string, timeZone: .current).participants
            } else {
                participants = LinkedInConnectionsParser.parse(string).map(\.fullName)
            }
            mapping = ImportPlanner.suggestedMapping(for: participants, people: Array(model.snapshot.people.values))
        }
    }

    func currentPlan() -> ImportPlan? {
        guard let text, let format else { return nil }
        let chosen = mapping.compactMapValues { $0 }
        switch format {
        case .whatsAppChat: return model.previewWhatsAppImport(text, selfName: selfName, mapping: chosen, preferDayFirst: dayFirst).1
        case .linkedInConnections: return model.previewLinkedInImport(text, mapping: chosen)
        }
    }
}
