import LTAppCore
import LTDomain
import LTIntegrations
import LTIntelligence
import LTVault
import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmDeleteAll = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Stored only on this iPhone, encrypted", systemImage: "lock.shield")
                    Label("No account, no analytics, no cloud AI", systemImage: "icloud.slash")
                    Text("Contacts and calendars you connect may already sync through iCloud or Google; LittleThings can't change how those services store their own data.")
                        .font(.footnote).foregroundStyle(.secondary)
                } header: { Text("Privacy") }

                Section("Lock") {
                    Picker("Lock after leaving the app", selection: preference(\.appLockTimeoutSeconds)) {
                        Text("Immediately").tag(0)
                        Text("1 minute").tag(60)
                        Text("5 minutes").tag(300)
                        Text("15 minutes").tag(900)
                    }
                    Button("Lock now") { Task { await model.lock() } }
                }

                Section {
                    LabeledContent("Permission", value: model.notificationAuthorization.rawValue.capitalized)
                    if model.notificationAuthorization == .notDetermined {
                        Button("Turn on reminders") { Task { await model.requestNotificationPermission() } }
                    }
                    Picker("Lock-screen text", selection: preference(\.notificationPrivacy)) {
                        Text("Generic").tag(NotificationPrivacy.generic)
                        Text("Show names and details").tag(NotificationPrivacy.detailed)
                    }
                    Toggle("Quiet hours", isOn: preference(\.quietHours.isEnabled))
                    DatePicker("Daily summary", selection: timeBinding(\.digestTime), displayedComponents: .hourAndMinute)
                } header: { Text("Reminders") } footer: {
                    Text("Generic text reads “You have a relationship reminder.” Private dates always stay generic. Reminders are scheduled on this iPhone and iOS decides exactly when background work runs.")
                }

                Section("Suggestions") {
                    Toggle("Show suggestions", isOn: preference(\.suggestionsEnabled))
                    Stepper("Cards on Today: \(model.snapshot.preferences.dailyCardLimit)", value: preference(\.dailyCardLimit), in: 1...10)
                }

                Section("On-device AI") {
                    Text(model.localModelAvailability.userFacingText)
                }

                Section("Sources") {
                    NavigationLink("What can LittleThings see?") { SourcesView() }
                    NavigationLink("Import a chat or export") { ImportView() }
                }

                Section {
                    NavigationLink("Encrypted backup") { BackupView() }
                    NavigationLink("Restore from backup") { RestoreView() }
                } header: { Text("Backup") } footer: {
                    if let last = model.snapshot.preferences.lastBackupAt {
                        Text("Last backup \(last.formatted(.dateTime.month().day().year()))")
                    } else {
                        Text("No backup yet. If this iPhone is lost, records without a backup can't be recovered.")
                    }
                }

                Section {
                    Button("Delete everything", role: .destructive) { confirmDeleteAll = true }
                        .accessibilityIdentifier("deleteEverythingButton")
                } footer: {
                    Text("Removes the vault, keys and pending reminders from this iPhone. Backups you exported and messages already sent can't be erased by LittleThings. Flash storage can't be guaranteed to be forensically wiped, but without the key the remains are unreadable.")
                }

                #if DEBUG
                Section("Developer") { NavigationLink("Diagnostics") { DiagnosticsView() } }
                #endif
            }
            .navigationTitle("Settings")
            .confirmationDialog("Delete everything on this iPhone?", isPresented: $confirmDeleteAll, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) { Task { await model.deleteEverything() } }
                    .accessibilityIdentifier("confirmDeleteEverything")
            } message: {
                Text("This can't be undone.")
            }
        }
    }

    func preference<T>(_ keyPath: WritableKeyPath<Preferences, T>) -> Binding<T> {
        Binding(get: { model.snapshot.preferences[keyPath: keyPath] }, set: { value in
            var p = model.snapshot.preferences
            p[keyPath: keyPath] = value
            Task { [p] in try? await model.updatePreferences(p) }
        })
    }

    func timeBinding(_ keyPath: WritableKeyPath<Preferences, TimeOfDay>) -> Binding<Date> {
        Binding(get: {
            let t = model.snapshot.preferences[keyPath: keyPath]
            return Calendar.current.date(bySettingHour: t.hour, minute: t.minute, second: 0, of: Date()) ?? Date()
        }, set: { date in
            let c = Calendar.current.dateComponents([.hour, .minute], from: date)
            var p = model.snapshot.preferences
            p[keyPath: keyPath] = TimeOfDay(hour: c.hour ?? 9, minute: c.minute ?? 0)
            Task { [p] in try? await model.updatePreferences(p) }
        })
    }
}

/// Honest source coverage (FR12): research status, what this build implements, and the next
/// experiment for routes that aren't available. Unsupported routes never show Connect.
struct SourcesView: View {
    @Environment(AppModel.self) private var model
    @State private var revoking: Connection?

    var body: some View {
        List {
            let connections = model.snapshot.connections.values.sorted { $0.createdAt < $1.createdAt }
            if !connections.isEmpty {
                Section("Your imports and connections") {
                    ForEach(connections) { c in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(c.displayName)
                            Text(c.isManualImport ? "One-off import you chose — not monitored" : c.scopeDescription).font(.caption).foregroundStyle(.secondary)
                            if let refreshed = c.lastSuccessfulRefresh { Text("Up to \(refreshed.formatted(.dateTime.month().day()))").font(.caption).foregroundStyle(.secondary) }
                            if c.state != .connected { Text("Not active: \(String(describing: c.state))").font(.caption).foregroundStyle(.orange) }
                            Button("Stop using this source", role: .destructive) { revoking = c }.font(.caption)
                        }
                    }
                }
            }
            if let registry = model.sourceRegistry {
                ForEach(IntegrationCapabilityRegistry.requiredChannels + ["platform"], id: \.self) { channel in
                    Section(title(channel)) {
                        ForEach(registry.entries(forChannel: channel)) { entry in
                            let summary = registry.summary(for: entry, now: Date())
                            DisclosureGroup {
                                Text(summary.detail).font(.caption)
                                if !summary.canConnect { Text("Next step: \(summary.nextStep)").font(.caption).foregroundStyle(.secondary) }
                                if let verified = entry.verifiedOn { Text("Documentation checked \(verified)").font(.caption2).foregroundStyle(.tertiary) }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.route).font(.subheadline)
                                    Text(summary.statusLine).font(.caption).foregroundStyle(summary.canConnect ? Palette.accent : .secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Sources")
        .confirmationDialog("Stop using \(revoking?.displayName ?? "this source")?", isPresented: Binding(get: { revoking != nil }, set: { if !$0 { revoking = nil } }), titleVisibility: .visible, presenting: revoking) { c in
            Button("Stop and delete what it added", role: .destructive) { Task { try? await model.revoke(c.id, deleteImported: true) } }
            Button("Stop, keep what was imported") { Task { try? await model.revoke(c.id, deleteImported: false) } }
        }
    }

    func title(_ channel: String) -> String {
        switch channel {
        case "imessage-sms": return "iMessage & SMS"
        case "desktop-capture": return "Mac / desktop"
        case "linkedin": return "LinkedIn"
        case "whatsapp": return "WhatsApp"
        case "platform": return "iPhone capabilities"
        default: return channel.capitalized
        }
    }
}

// MARK: - Backup

struct ArchiveDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.data] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct BackupView: View {
    @Environment(AppModel.self) private var model
    @State private var newKey: RecoveryKey?
    @State private var confirmation = ""
    @State private var document: ArchiveDocument?
    @State private var exporting = false
    @State private var message: String?

    var body: some View {
        Form {
            Section {
                Text("Backups are encrypted with a recovery key that only you hold. Without it, a backup can't be opened — not even by LittleThings.")
                Text("You choose where to save the file. iCloud Drive or another cloud folder is a copy outside this iPhone; for strict device-only privacy, save it to a local or external drive.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if let key = newKey {
                Section {
                    Text(key.displayString)
                        .font(.system(.title3, design: .monospaced))
                        .textSelection(.enabled)
                        .accessibilityLabel("Recovery key \(key.displayString.map(String.init).joined(separator: " "))")
                    TextField("Type the last four characters to confirm", text: $confirmation)
                        .textInputAutocapitalization(.characters)
                    Button("I've written it down") {
                        guard confirmation.uppercased() == String(key.displayString.suffix(4)) else { message = "Those characters don't match."; return }
                        try? model.confirmRecoveryKeySaved(key)
                        newKey = nil
                        message = "Recovery key saved. You can now create backups."
                    }
                } header: { Text("Your recovery key") } footer: {
                    Text("Write it on paper or store it in a password manager. Losing it means losing access to your backups.")
                }
            } else {
                Section {
                    Button("Create encrypted backup") { export() }.accessibilityIdentifier("createBackupButton")
                }
            }
            if let message { Section { Text(message) } }
        }
        .navigationTitle("Backup")
        .fileExporter(isPresented: $exporting, document: document, contentType: .data, defaultFilename: "LittleThings-backup.ltbackup") { result in
            if case .failure = result { message = "The backup wasn't saved." } else { message = "Backup saved." }
        }
    }

    func export() {
        do {
            let (key, isNew) = try model.recoveryKey(createIfMissing: true)
            if isNew { newKey = key; return }
        } catch { message = "Couldn't read the recovery key." ; return }
        Task {
            do {
                document = ArchiveDocument(data: try await model.exportBackup())
                exporting = true
            } catch {
                message = "The backup couldn't be created."
            }
        }
    }
}

struct RestoreView: View {
    @Environment(AppModel.self) private var model
    @State private var importing = false
    @State private var archive: Data?
    @State private var keyText = ""
    @State private var preview: RestorePreview?
    @State private var confirm = false
    @State private var message: String?

    var body: some View {
        Form {
            Section {
                Button("Choose backup file") { importing = true }
            } footer: {
                Text("Restoring replaces everything currently in LittleThings on this iPhone. Merging isn't supported.")
            }
            if archive != nil {
                Section("Recovery key") {
                    TextField("XXXX-XXXX-…", text: $keyText).textInputAutocapitalization(.characters).autocorrectionDisabled()
                    Button("Check backup") { check() }
                }
            }
            if let preview {
                Section("This backup contains") {
                    LabeledContent("Created", value: preview.header.createdAt.formatted(.dateTime.month().day().year()))
                    LabeledContent("People", value: "\(preview.people)")
                    LabeledContent("Notes", value: "\(preview.notes)")
                    LabeledContent("Dates", value: "\(preview.dates)")
                    LabeledContent("Promises", value: "\(preview.promises)")
                    Button("Replace my data with this backup", role: .destructive) { confirm = true }
                }
            }
            if let message { Section { Text(message) } }
        }
        .navigationTitle("Restore")
        .fileImporter(isPresented: $importing, allowedContentTypes: [.data]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            archive = try? Data(contentsOf: url)
            preview = nil
        }
        .confirmationDialog("Replace everything with this backup?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Replace", role: .destructive) { restore() }
        } message: { Text("Your current data on this iPhone will be replaced.") }
    }

    func check() {
        guard let archive else { return }
        do {
            preview = try model.previewRestore(archive, recoveryKeyText: keyText)
            message = nil
        } catch BackupError.recoveryKeyTypo {
            message = "That recovery key has a typo."
        } catch BackupError.wrongRecoveryKey {
            message = "This backup was made with a different recovery key."
        } catch BackupError.newerSchema {
            message = "This backup is from a newer version of LittleThings. Update the app first."
        } catch {
            message = "This file isn't a valid LittleThings backup or it was damaged. Nothing was changed."
        }
    }

    func restore() {
        guard let archive else { return }
        Task {
            do {
                try await model.restore(archive, recoveryKeyText: keyText)
                message = "Restored."
            } catch {
                message = "Restore failed. Your current data was not changed."
            }
        }
    }
}

#if DEBUG
/// Counts and states only — never record contents.
struct DiagnosticsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            LabeledContent("Records", value: "\(model.snapshot.recordCount)")
            LabeledContent("People", value: "\(model.snapshot.people.count)")
            LabeledContent("Suggestion records", value: "\(model.snapshot.suggestions.count)")
            LabeledContent("Connections", value: "\(model.snapshot.connections.count)")
            LabeledContent("Notifications", value: model.notificationAuthorization.rawValue)
            LabeledContent("Local model", value: model.localModelAvailability.isAvailable ? "available" : "unavailable")
            LabeledContent("Device protection", value: model.deviceProtection.canStoreRealData ? "passcode set" : "no passcode")
            LabeledContent("Demo", value: model.isDemo ? "yes" : "no")
        }
        .navigationTitle("Diagnostics")
    }
}
#endif
