import LTAppCore
import LTDomain
import LTIntegrations
import LTPolicy
import SwiftUI

/// Person page: context, timeline, dates, promises, details with evidence, gifts, boundaries.
struct PersonDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    let personID: PersonID

    @State private var sheet: Sheet?
    @State private var deletionPlan: PersonDeletionPlan?
    @State private var sourceToDelete: SourceID?

    enum Sheet: String, Identifiable {
        case edit, memory, date, promise, interaction, gift, linkEvent
        var id: String { rawValue }
    }

    var person: Person? { model.snapshot.people[personID] }

    var body: some View {
        if let person {
            List {
                header(person)
                datesSection
                promisesSection
                detailsSection
                giftsSection
                if let boundaries = person.boundaries, !boundaries.isEmpty {
                    Section("Handle with care") { Text(boundaries) }
                }
                timelineSection
                manageSection(person)
            }
            .navigationTitle(person.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Add memory", systemImage: "text.badge.plus") { sheet = .memory }
                        Button("Log a conversation", systemImage: "bubble.left.and.bubble.right") { sheet = .interaction }
                        Button("Add date", systemImage: "calendar.badge.plus") { sheet = .date }
                        Button("Add promise", systemImage: "checkmark.circle") { sheet = .promise }
                        Button("Add gift idea", systemImage: "gift") { sheet = .gift }
                        Button("Link a calendar event", systemImage: "calendar") { sheet = .linkEvent }
                        Button("Edit", systemImage: "pencil") { sheet = .edit }
                    } label: { Image(systemName: "plus") }
                    .accessibilityIdentifier("personAddMenu")
                }
            }
            .sheet(item: $sheet) { sheet in
                NavigationStack {
                    switch sheet {
                    case .edit: PersonEditView(person: person)
                    case .memory: AddMemoryView(preselected: [personID])
                    case .date: AddDateView(personID: personID)
                    case .promise: AddPromiseView(personID: personID)
                    case .interaction: LogInteractionView(personID: personID)
                    case .gift: AddGiftView(personID: personID)
                    case .linkEvent: LinkEventView(personID: personID)
                    }
                }
            }
            .confirmationDialog("Delete \(person.name)?", isPresented: Binding(get: { deletionPlan != nil }, set: { if !$0 { deletionPlan = nil } }), titleVisibility: .visible, presenting: deletionPlan) { plan in
                Button("Delete from LittleThings", role: .destructive) {
                    Task { try? await model.deletePerson(plan); dismiss() }
                }
            } message: { plan in
                Text((plan.previewLines.isEmpty ? "" : "This removes " + plan.previewLines.joined(separator: ", ") + ". ") + "Shared notes stay with the other people. Your iPhone's Contacts are not changed. Copies you exported or messages already sent can't be erased.")
            }
            .confirmationDialog("Delete this note?", isPresented: Binding(get: { sourceToDelete != nil }, set: { if !$0 { sourceToDelete = nil } }), titleVisibility: .visible) {
                Button("Delete note and details from it", role: .destructive) { deleteSource(keepConfirmed: false) }
                Button("Delete note, keep confirmed details") { deleteSource(keepConfirmed: true) }
            } message: {
                if let id = sourceToDelete { Text(model.sourceDeletionPreview(id, keepConfirmed: false).summary) }
            }
        } else {
            ContentUnavailableView("This person was deleted", systemImage: "person.slash")
        }
    }

    func header(_ person: Person) -> some View {
        Section {
            HStack(spacing: 16) {
                InitialsAvatar(name: person.name, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(person.displayName).font(.title3.weight(.semibold))
                    Text([person.relationshipLabel, person.city].compactMap { $0 }.joined(separator: " · ")).foregroundStyle(.secondary)
                    if person.reminderPreferences.isPaused { Label("Reminders paused", systemImage: "pause.circle").font(.caption).foregroundStyle(.secondary) }
                }
            }
            if let notes = person.notes, !notes.isEmpty { Text(notes) }
        }
    }

    var datesSection: some View {
        let dates = model.snapshot.importantDates.values.filter { $0.personID == personID }.sorted { $0.label < $1.label }
        return Section("Dates") {
            if dates.isEmpty { Text("No dates yet").foregroundStyle(.secondary) }
            ForEach(dates) { date in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(date.label)
                        if date.isSensitive { Image(systemName: "lock").foregroundStyle(.secondary).accessibilityLabel("Private") }
                        Spacer()
                        Text(describe(date)).foregroundStyle(.secondary)
                    }
                    if date.confirmation != .confirmed { Text("From a source — not yet confirmed").font(.caption).foregroundStyle(.orange) }
                    if date.needsLeapDayChoice { Text("Choose Feb 28 or Mar 1 for non-leap years in Review").font(.caption).foregroundStyle(.orange) }
                }
            }
        }
    }

    func describe(_ date: ImportantDate) -> String {
        switch date.schedule {
        case .annual(let a):
            let base = DateFormatter().monthSymbols[a.month - 1] + " \(a.day)"
            return a.year.map { base + ", \($0)" } ?? base
        case .once(let day):
            return day.isoString
        }
    }

    var promisesSection: some View {
        let promises = model.snapshot.promises.values.filter { $0.personIDs.contains(personID) && $0.status == .open }.sorted { $0.createdAt < $1.createdAt }
        return Section("Promises") {
            if promises.isEmpty { Text("No open promises").foregroundStyle(.secondary) }
            ForEach(promises) { promise in
                HStack {
                    VStack(alignment: .leading) {
                        Text(promise.description)
                        if let due = promise.due { Text("Due \(due.day(in: .current).isoString)").font(.caption).foregroundStyle(.secondary) }
                    }
                    Spacer()
                    Button { Task { try? await model.setPromiseStatus(promise.id, .done) } } label: {
                        Image(systemName: "checkmark.circle")
                    }
                    .accessibilityLabel("Mark done")
                }
                .swipeActions { Button("Cancel", role: .destructive) { Task { try? await model.setPromiseStatus(promise.id, .cancelled) } } }
            }
        }
    }

    var detailsSection: some View {
        let facts = model.snapshot.facts.values.filter { $0.personID == personID }.sorted { $0.label < $1.label }
        return Section("Details") {
            if facts.isEmpty { Text("Add a memory to start remembering details.").foregroundStyle(.secondary) }
            ForEach(facts) { fact in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(fact.label).foregroundStyle(.secondary)
                        Spacer()
                        Text(fact.value)
                    }
                    if let excerpt = fact.excerpt, fact.origin.isSourceDerived {
                        Text("“\(excerpt)”").font(.caption).foregroundStyle(.secondary)
                    }
                    if fact.state != .confirmed {
                        Text(fact.origin == .autoSaved ? "Saved automatically — not confirmed" : "Not yet confirmed").font(.caption).foregroundStyle(.orange)
                    }
                }
                .swipeActions {
                    Button("Delete", role: .destructive) { Task { try? await model.commit([.delete(.fact(fact.id))]) } }
                }
            }
        }
    }

    var giftsSection: some View {
        let gifts = model.snapshot.gifts.values.filter { $0.personID == personID }.sorted { $0.createdAt < $1.createdAt }
        return Section("Gifts") {
            if gifts.isEmpty { Text("No gift ideas yet").foregroundStyle(.secondary) }
            ForEach(gifts) { gift in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(gift.title)
                        Spacer()
                        Text(gift.state.rawValue.capitalized).font(.caption).foregroundStyle(.secondary)
                    }
                    if let budget = gift.budget {
                        Text(Double(budget.minorUnits) / 100, format: .currency(code: budget.currencyCode)).font(.caption).foregroundStyle(.secondary)
                    }
                    HStack {
                        if let url = GiftActions.urlToOpen(gift) {
                            Button("Open merchant page") { openURL(url) }.buttonStyle(.bordered).controlSize(.small)
                        }
                        Menu("Mark as…") {
                            ForEach(GiftState.allCases, id: \.self) { state in
                                Button(state.rawValue.capitalized) { Task { try? await model.setGiftState(gift.id, state) } }
                            }
                        }
                        .controlSize(.small)
                    }
                    if GiftActions.urlToOpen(gift) != nil {
                        Text("Opening a link never marks a gift purchased. The merchant may or may not offer Apple Pay.").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    var timelineSection: some View {
        Section("Timeline") {
            let entries = model.timeline(for: personID)
            if entries.isEmpty { Text("Nothing logged yet").foregroundStyle(.secondary) }
            ForEach(entries.prefix(50)) { entry in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(entry.title)
                        Spacer()
                        Text(entry.date, format: .dateTime.month().day()).font(.caption).foregroundStyle(.secondary)
                    }
                    if let detail = entry.detail { Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(3) }
                    Text(entry.provenance).font(.caption2).foregroundStyle(.tertiary)
                }
                .swipeActions {
                    if entry.kind == .note, let id = SourceID(uuidString: String(entry.id.dropFirst("source:".count))) {
                        Button("Delete", role: .destructive) { sourceToDelete = id }
                    }
                }
            }
        }
    }

    func manageSection(_ person: Person) -> some View {
        Section {
            Toggle("Pause reminders", isOn: Binding(get: { person.reminderPreferences.isPaused }, set: { v in Task { try? await model.setPaused(personID, v) } }))
                .accessibilityIdentifier("pauseToggle")
            Toggle("Suggest check-ins from connected conversations", isOn: Binding(get: { person.reminderPreferences.observedPatternEnabled }, set: { v in
                var p = person
                p.reminderPreferences.observedPatternEnabled = v
                Task { try? await model.updatePerson(p) }
            }))
            Toggle("Favorite", isOn: Binding(get: { person.isFavorite }, set: { v in
                var p = person
                p.isFavorite = v
                Task { try? await model.updatePerson(p) }
            }))
            Button(person.isArchived ? "Unarchive" : "Archive") { Task { try? await model.setArchived(personID, !person.isArchived) } }
            Button("Delete \(person.name)", role: .destructive) { deletionPlan = model.deletionPreview(for: personID) }
                .accessibilityIdentifier("deletePersonButton")
        } footer: {
            Text("Check-in suggestions only use sources you connected and never claim to know every conversation.")
        }
    }

    func deleteSource(keepConfirmed: Bool) {
        guard let id = sourceToDelete else { return }
        Task { try? await model.deleteSource(model.sourceDeletionPreview(id, keepConfirmed: keepConfirmed)) }
        sourceToDelete = nil
    }
}
