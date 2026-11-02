import LTAppCore
import LTDomain
import LTIntegrations
import LTIntelligence
import PhotosUI
import SwiftUI

/// Persistent Add action: person, memory, interaction, date, promise (plus trip).
struct AddMenu: View {
    @State private var sheet: Kind?
    enum Kind: String, Identifiable { case person, memory, interaction, date, promise, trip, importFile; var id: String { rawValue } }

    var body: some View {
        Menu {
            Button("Memory", systemImage: "text.badge.plus") { sheet = .memory }
            Button("Person", systemImage: "person.badge.plus") { sheet = .person }
            Button("Conversation", systemImage: "bubble.left.and.bubble.right") { sheet = .interaction }
            Button("Date", systemImage: "calendar.badge.plus") { sheet = .date }
            Button("Promise", systemImage: "checkmark.circle") { sheet = .promise }
            Button("Trip", systemImage: "airplane") { sheet = .trip }
            Button("Import a chat or export…", systemImage: "square.and.arrow.down") { sheet = .importFile }
        } label: {
            Image(systemName: "plus.circle.fill").font(.title2)
        }
        .accessibilityLabel("Add")
        .accessibilityIdentifier("addMenu")
        .sheet(item: $sheet) { kind in
            NavigationStack {
                switch kind {
                case .person: PersonEditView(person: nil)
                case .memory: AddMemoryView(preselected: [])
                case .interaction: LogInteractionView(personID: nil)
                case .date: AddDateView(personID: nil)
                case .promise: AddPromiseView(personID: nil)
                case .trip: AddTripView()
                case .importFile: ImportView()
                }
            }
        }
    }
}

struct PersonMultiPicker: View {
    @Environment(AppModel.self) private var model
    @Binding var selection: Set<PersonID>

    var body: some View {
        ForEach(model.snapshot.activePeople) { person in
            Button {
                if selection.contains(person.id) { selection.remove(person.id) } else { selection.insert(person.id) }
            } label: {
                HStack {
                    Text(person.name).foregroundStyle(.primary)
                    Spacer()
                    if selection.contains(person.id) { Image(systemName: "checkmark").foregroundStyle(Palette.accent) }
                }
            }
            .accessibilityAddTraits(selection.contains(person.id) ? .isSelected : [])
        }
    }
}

struct PersonSinglePicker: View {
    @Environment(AppModel.self) private var model
    @Binding var selection: PersonID?

    var body: some View {
        Picker("Person", selection: $selection) {
            Text("Choose…").tag(PersonID?.none)
            ForEach(model.snapshot.activePeople) { Text($0.name).tag(Optional($0.id)) }
        }
        .accessibilityIdentifier("personPicker")
    }
}

// MARK: - Memory

struct AddMemoryView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()
    @State private var text = ""
    @State private var people: Set<PersonID>
    @State private var sensitive = false
    @State private var capture: MemoryCapture?
    @State private var photo: PhotosPickerItem?
    @State private var working = false
    @State private var error: String?

    init(preselected: [PersonID]) {
        _people = State(initialValue: Set(preselected))
    }

    var body: some View {
        Form {
            Section {
                TextField("What do you want to remember?", text: $text, axis: .vertical)
                    .lineLimit(4...12)
                    .accessibilityIdentifier("memoryText")
                if OnDeviceTranscriber.isAvailable() {
                    Button(recorder.isRecording ? "Stop recording" : "Record a voice memory", systemImage: recorder.isRecording ? "stop.circle.fill" : "mic") { toggleRecording() }
                        .foregroundStyle(recorder.isRecording ? .red : Palette.accent)
                    if recorder.isRecording { Label("Recording… audio is transcribed on this iPhone, then deleted", systemImage: "record.circle").foregroundStyle(.red).font(.caption) }
                }
                PhotosPicker(selection: $photo, matching: .images) { Label("Read text from a photo", systemImage: "text.viewfinder") }
            } footer: {
                Text(model.localModelAvailability.userFacingText)
            }
            Section("About") { PersonMultiPicker(selection: $people) }
            Section {
                Toggle("This is sensitive", isOn: $sensitive)
            } footer: {
                Text("Sensitive notes are never used in suggestions, drafts or lock-screen text unless you choose them.")
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
        }
        .navigationTitle("Add memory")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { recorder.discard(); dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || working)
                    .accessibilityIdentifier("saveMemoryButton")
            }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let recognized = try? await TextRecognizer.recognizeText(in: data), !recognized.isEmpty {
                    text = text.isEmpty ? recognized : text + "\n" + recognized
                }
            }
        }
        .navigationDestination(item: Binding(get: { capture.map(CaptureBox.init) }, set: { if $0 == nil { capture = nil; dismiss() } })) { box in
            ProposalReviewView(capture: box.capture, allowsLinkingPeople: false)
        }
    }

    func toggleRecording() {
        if recorder.isRecording {
            guard let url = recorder.stop() else { return }
            Task {
                do {
                    let transcript = try await OnDeviceTranscriber.transcribe(fileURL: url)
                    text += (text.isEmpty ? "" : "\n") + transcript
                }
                catch { self.error = "Couldn't transcribe on this iPhone. You can type instead." }
            }
        } else {
            Task {
                guard await OnDeviceTranscriber.requestAuthorization() else { error = "Speech recognition is off in Settings."; return }
                do { try recorder.start() } catch { self.error = "The microphone isn't available." }
            }
        }
    }

    func save() {
        working = true
        Task {
            do {
                capture = try await model.addMemory(text, people: Array(people), sensitivity: sensitive ? .sensitive : .normal)
            } catch {
                self.error = "The memory couldn't be saved."
            }
            working = false
        }
    }
}

/// Review proposed details and actions separately; confirm individually or in a batch.
struct ProposalReviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State var capture: MemoryCapture
    let allowsLinkingPeople: Bool

    @State private var keepFacts: Set<Int> = []
    @State private var keepDates: Set<Int> = []
    @State private var keepPromises: Set<Int> = []
    @State private var keepEvents: Set<Int> = []
    @State private var identity: [String: PersonID] = [:]
    @State private var leap: [Int: LeapDayPolicy] = [:]
    @State private var linkPeople: Set<PersonID> = []

    var body: some View {
        List {
            Section("Saved note") {
                Text(capture.source.text).font(.callout)
                Text(capture.usedLocalModel ? "Suggestions from on-device AI. Check each one." : "Suggestions from your wording. Check each one.").font(.caption).foregroundStyle(.secondary)
                if capture.autoSavedCount > 0 {
                    Text("\(capture.autoSavedCount) detail(s) were saved automatically and stay marked unconfirmed.").font(.caption).foregroundStyle(.secondary)
                }
            }
            if allowsLinkingPeople && capture.source.personIDs.isEmpty {
                Section("Who is this about?") {
                    PersonMultiPicker(selection: $linkPeople)
                    Button("Link and suggest details") {
                        Task { if let updated = try? await model.link(capture.source.id, to: Array(linkPeople)) { capture = updated } }
                    }
                    .disabled(linkPeople.isEmpty)
                }
            }
            if !capture.proposal.facts.isEmpty || !capture.proposal.lifeEvents.isEmpty {
                Section("Details") {
                    ForEach(capture.proposal.facts.indices, id: \.self) { i in
                        let fact = capture.proposal.facts[i]
                        row(isOn: $keepFacts, index: i, title: "\(fact.label): \(fact.value)", excerpt: fact.excerpt, note: fact.isSensitive ? "Sensitive" : nil)
                        identityPicker(fact.identity, key: "f\(i)")
                    }
                    ForEach(capture.proposal.lifeEvents.indices, id: \.self) { i in
                        let event = capture.proposal.lifeEvents[i]
                        row(isOn: $keepEvents, index: i, title: event.summary, excerpt: event.excerpt, note: event.explicitness == .inferred ? "Sounds like a plan or hope, not a current event" : (event.eventDate == nil ? "No date in the note" : nil))
                        identityPicker(event.identity, key: "e\(i)")
                    }
                }
            }
            if !capture.proposal.dates.isEmpty || !capture.proposal.promises.isEmpty {
                Section("Reminders and promises") {
                    ForEach(capture.proposal.dates.indices, id: \.self) { i in
                        let date = capture.proposal.dates[i]
                        row(isOn: $keepDates, index: i, title: "\(date.label): \(date.match.resolvedDay.isoString)", excerpt: date.excerpt, note: dateNote(date))
                        identityPicker(date.identity, key: "d\(i)")
                        if date.match.month == 2 && date.match.day == 29 && date.category != .milestone {
                            Picker("In non-leap years", selection: Binding(get: { leap[i] }, set: { leap[i] = $0 })) {
                                Text("Choose…").tag(LeapDayPolicy?.none)
                                Text("February 28").tag(Optional(LeapDayPolicy.february28))
                                Text("March 1").tag(Optional(LeapDayPolicy.march1))
                            }
                        }
                    }
                    ForEach(capture.proposal.promises.indices, id: \.self) { i in
                        let promise = capture.proposal.promises[i]
                        row(isOn: $keepPromises, index: i, title: promise.description, excerpt: promise.excerpt, note: promise.due.map { "Due \($0.resolvedDay.isoString)" + ($0.interpretation.needsConfirmation ? " — check this date" : "") })
                        identityPicker(promise.identity, key: "p\(i)")
                    }
                }
            }
            if capture.proposal.isEmpty {
                Section { Text("No details to suggest. Your note is saved and searchable.").foregroundStyle(.secondary) }
            }
            if !capture.proposal.rejected.isEmpty {
                Section("Not suggested") {
                    ForEach(capture.proposal.rejected, id: \.self) { r in
                        Text("\(r.item): \(r.reason)").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Review")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save selected") { save() }.accessibilityIdentifier("saveSelectedButton")
            }
            ToolbarItem(placement: .cancellationAction) { Button("Skip") { dismiss() } }
        }
        .onAppear(perform: preselect)
    }

    func dateNote(_ date: ProposedDate) -> String? {
        switch date.match.interpretation {
        case .explicit: return date.isSensitive ? "Sensitive — reminders stay off unless you turn them on" : nil
        case .inferredYear: return "Year not written — assumed \(date.match.resolvedDay.year)"
        case .relativeToCapture(let phrase): return "“\(phrase)” read from the note's date — check it"
        case .ambiguousNumeric: return "Could be read two ways — check it"
        }
    }

    func row(isOn set: Binding<Set<Int>>, index: Int, title: String, excerpt: String, note: String?) -> some View {
        Toggle(isOn: Binding(get: { set.wrappedValue.contains(index) }, set: { if $0 { set.wrappedValue.insert(index) } else { set.wrappedValue.remove(index) } })) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                Text("“\(excerpt)”").font(.caption).foregroundStyle(.secondary)
                if let note { Text(note).font(.caption).foregroundStyle(.orange) }
            }
        }
    }

    @ViewBuilder func identityPicker(_ resolution: IdentityResolution, key: String) -> some View {
        switch resolution {
        case .resolved: EmptyView()
        case .ambiguous(let ids):
            Picker("Which person?", selection: Binding(get: { identity[key] }, set: { identity[key] = $0 })) {
                Text("Choose…").tag(PersonID?.none)
                ForEach(ids, id: \.self) { id in Text(model.snapshot.people[id]?.name ?? "?").tag(Optional(id)) }
            }
        case .unresolved:
            Picker("Which person?", selection: Binding(get: { identity[key] }, set: { identity[key] = $0 })) {
                Text("Choose…").tag(PersonID?.none)
                ForEach(model.snapshot.activePeople) { Text($0.name).tag(Optional($0.id)) }
            }
        }
    }

    /// Explicit items are preselected; anything needing confirmation starts unselected.
    func preselect() {
        let p = capture.proposal
        keepFacts = Set(p.facts.indices.filter { p.facts[$0].identity.personID != nil && !p.facts[$0].isSensitive })
        keepDates = Set(p.dates.indices.filter { p.dates[$0].identity.personID != nil && !p.dates[$0].match.interpretation.needsConfirmation })
        keepPromises = Set(p.promises.indices.filter { p.promises[$0].identity.personID != nil })
        keepEvents = Set(p.lifeEvents.indices.filter { p.lifeEvents[$0].identity.personID != nil && p.lifeEvents[$0].explicitness == .explicit })
    }

    func person(_ resolution: IdentityResolution, _ key: String) -> PersonID? {
        resolution.personID ?? identity[key]
    }

    func save() {
        let p = capture.proposal
        var selection = ProposalSelection()
        for i in keepFacts.sorted() { if let id = person(p.facts[i].identity, "f\(i)") { selection.facts.append((p.facts[i], id)) } }
        for i in keepDates.sorted() {
            if let id = person(p.dates[i].identity, "d\(i)") {
                let needsLeap = p.dates[i].match.month == 2 && p.dates[i].match.day == 29 && p.dates[i].category != .milestone
                if needsLeap && leap[i] == nil { continue } // never guess
                selection.dates.append((p.dates[i], id, leap[i]))
            }
        }
        for i in keepPromises.sorted() { if let id = person(p.promises[i].identity, "p\(i)") { selection.promises.append((p.promises[i], [id])) } }
        for i in keepEvents.sorted() { if let id = person(p.lifeEvents[i].identity, "e\(i)") { selection.lifeEvents.append((p.lifeEvents[i], id)) } }
        Task { try? await model.confirm(selection, from: capture.source); dismiss() }
    }
}

// MARK: - Dates, promises, interactions, gifts, trips, calendar

struct AddDateView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var personID: PersonID?
    @State private var category: DateCategory = .birthday
    @State private var label = ""
    @State private var date = Date()
    @State private var includeYear = false
    @State private var leapPolicy: LeapDayPolicy?
    @State private var remindersOn = true
    @State private var planningLead = 14

    init(personID: PersonID?) { _personID = State(initialValue: personID) }

    var components: DateComponents { Calendar.current.dateComponents([.year, .month, .day], from: date) }
    var isLeapDay: Bool { components.month == 2 && components.day == 29 }

    var body: some View {
        Form {
            Section { PersonSinglePicker(selection: $personID) }
            Section {
                Picker("Kind", selection: $category) {
                    Text("Birthday").tag(DateCategory.birthday)
                    Text("Anniversary").tag(DateCategory.anniversary)
                    Text("One-time milestone").tag(DateCategory.milestone)
                    Text("Yearly date").tag(DateCategory.customAnnual)
                    Text("Needs extra care").tag(DateCategory.careful)
                }
                .accessibilityIdentifier("dateKindPicker")
                if category != .birthday { TextField("Label", text: $label) }
                DatePicker("Date", selection: $date, displayedComponents: .date)
                if category == .birthday || category == .anniversary {
                    Toggle("I know the year", isOn: $includeYear)
                }
                if isLeapDay && category != .milestone {
                    Picker("In non-leap years", selection: $leapPolicy) {
                        Text("Choose…").tag(LeapDayPolicy?.none)
                        Text("February 28").tag(Optional(LeapDayPolicy.february28))
                        Text("March 1").tag(Optional(LeapDayPolicy.march1))
                    }
                }
            } footer: {
                if category == .careful { Text("Dates that need care stay private and never get celebratory messages. Reminders are off unless you turn them on.") }
            }
            Section("Reminders") {
                Toggle("Remind me", isOn: $remindersOn)
                if remindersOn && category != .careful {
                    Stepper("Plan ahead: \(planningLead) days before", value: $planningLead, in: 0...60)
                }
            }
        }
        .navigationTitle("Add date")
        .onChange(of: category) { _, new in remindersOn = new != .careful }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(personID == nil || (isLeapDay && category != .milestone && leapPolicy == nil))
                    .accessibilityIdentifier("saveDateButton")
            }
        }
    }

    func save() {
        guard let personID, let month = components.month, let day = components.day else { return }
        let schedule: DateSchedule = category == .milestone
            ? .once(CalendarDay(date))
            : .annual(AnnualDate(month: month, day: day, year: includeYear ? components.year : nil) ?? AnnualDate(month: month, day: day)!)
        let offsets = category == .careful ? [0] : Array(Set([planningLead, 0])).sorted(by: >)
        let item = ImportantDate(personID: personID, category: category, label: label.nilIfEmpty, schedule: schedule, leapDayPolicy: leapPolicy, reminderOffsetsDays: offsets, remindersEnabled: remindersOn, createdAt: Date())
        Task { try? await model.save(item); dismiss() }
    }
}

struct AddPromiseView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var personID: PersonID?
    @State private var description = ""
    @State private var kind: PromiseKind = .commitment
    @State private var hasDue = false
    @State private var due = Date()
    @State private var pinned = false

    init(personID: PersonID?) { _personID = State(initialValue: personID) }

    var body: some View {
        Form {
            Section { PersonSinglePicker(selection: $personID) }
            Section {
                Picker("Type", selection: $kind) {
                    Text("Something I'll do").tag(PromiseKind.commitment)
                    Text("Something to ask about").tag(PromiseKind.followUp)
                }
                TextField(kind == .commitment ? "e.g. Send the book recommendation" : "e.g. Ask how the interview went", text: $description, axis: .vertical)
                    .accessibilityIdentifier("promiseText")
                Toggle("Due date", isOn: $hasDue)
                if hasDue { DatePicker("Due", selection: $due, displayedComponents: .date) }
                Toggle("Pin to Today", isOn: $pinned)
            } footer: {
                Text("Promises without a date stay on the person's page and never become overdue on their own.")
            }
        }
        .navigationTitle("Add promise")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    guard let personID else { return }
                    let promise = Promise(personIDs: [personID], kind: kind, description: description.trimmingCharacters(in: .whitespacesAndNewlines), due: hasDue ? .day(CalendarDay(due)) : nil, isPinned: pinned, createdAt: Date())
                    Task { try? await model.save(promise); dismiss() }
                }
                .disabled(personID == nil || description.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("savePromiseButton")
            }
        }
    }
}

struct LogInteractionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var personID: PersonID?
    @State private var kind: InteractionKind = .call
    @State private var date = Date()
    @State private var summary = ""

    init(personID: PersonID?) { _personID = State(initialValue: personID) }

    var body: some View {
        Form {
            Section { PersonSinglePicker(selection: $personID) }
            Section {
                Picker("How", selection: $kind) {
                    ForEach(InteractionKind.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                DatePicker("When", selection: $date, in: ...Date())
                TextField("A short note (optional)", text: $summary, axis: .vertical)
            }
        }
        .navigationTitle("Log a conversation")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    guard let personID else { return }
                    Task { _ = try? await model.logInteraction(with: [personID], kind: kind, at: date, summary: summary.nilIfEmpty); dismiss() }
                }
                .disabled(personID == nil)
            }
        }
    }
}

struct AddGiftView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let personID: PersonID
    @State private var title = ""
    @State private var urlText = ""
    @State private var size = ""
    @State private var budget = ""
    @State private var currency = Locale.current.currency?.identifier ?? "USD"

    var body: some View {
        Form {
            Section {
                TextField("Gift idea", text: $title)
                TextField("Link (optional)", text: $urlText).keyboardType(.URL).textInputAutocapitalization(.never)
                TextField("Size, if they mentioned it", text: $size)
            }
            Section("Budget") {
                TextField("Amount", text: $budget).keyboardType(.decimalPad)
                TextField("Currency", text: $currency).textInputAutocapitalization(.characters)
            }
            Section {
                Text("LittleThings never stores card numbers. Purchases happen at the merchant's own checkout, which may offer Apple Pay.").font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Gift idea")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    let minor = Decimal(string: budget).map { NSDecimalNumber(decimal: $0 * 100).int64Value }
                    let gift = GiftIdea(personID: personID, title: title, url: URL(string: urlText), size: size.nilIfEmpty, budget: minor.map { Money(minorUnits: $0, currencyCode: currency) }, createdAt: Date())
                    Task { try? await model.save(gift); dismiss() }
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

struct AddTripView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var city = ""
    @State private var start = Date()
    @State private var end = Date().addingTimeInterval(2 * 86_400)
    @State private var uncertain = false

    var body: some View {
        Form {
            TextField("City", text: $city)
            DatePicker("From", selection: $start, displayedComponents: .date)
            DatePicker("To", selection: $end, in: start..., displayedComponents: .date)
            Toggle("Plans not confirmed yet", isOn: $uncertain)
        }
        .navigationTitle("Add trip")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { try? await model.save(Trip(city: city, startDay: CalendarDay(start), endDay: CalendarDay(end), isUncertain: uncertain, createdAt: Date())); dismiss() }
                }
                .disabled(city.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

/// Select a specific calendar event to associate with a person. Access is requested only here.
struct LinkEventView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let personID: PersonID
    @State private var provider = EventKitCalendarProvider()
    @State private var state: PermissionState = .notDetermined
    @State private var calendars: [CalendarInfo] = []
    @State private var selectedCalendars: Set<String> = []
    @State private var events: [CalendarEventInfo] = []
    @State private var business = false

    var body: some View {
        List {
            switch state {
            case .authorized:
                Section("Calendars") {
                    ForEach(calendars) { cal in
                        Toggle(cal.title, isOn: Binding(get: { selectedCalendars.contains(cal.id) }, set: { on in
                            if on { selectedCalendars.insert(cal.id) } else { selectedCalendars.remove(cal.id) }
                            Task { await loadEvents() }
                        }))
                    }
                }
                Section {
                    Toggle("This is a work event", isOn: $business)
                } footer: {
                    Text("Only the event you pick is saved — not your calendar.")
                }
                Section("Next 30 days") {
                    ForEach(events, id: \.self) { event in
                        Button {
                            Task { try? await model.linkCalendarEvent(event, people: [personID], context: business ? .business : .personal); dismiss() }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(event.title ?? "Event").foregroundStyle(.primary)
                                Text(event.startsAt, format: .dateTime.weekday().month().day().hour().minute()).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            case .denied, .restricted, .writeOnly:
                Text("Calendar access is off. You can turn it on in Settings › Privacy & Security › Calendars. Everything else keeps working.")
            default:
                Section {
                    Button("Allow calendar access") { Task { state = await provider.requestFullAccess(); await load() } }
                } footer: {
                    Text("LittleThings reads only calendars you select and stores only events you link.")
                }
            }
        }
        .navigationTitle("Link an event")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        .task { state = provider.authorizationState(); await load() }
    }

    func load() async {
        guard state.canRead else { return }
        calendars = (try? await provider.calendars()) ?? []
    }

    func loadEvents() async {
        events = (try? await provider.events(inCalendars: Array(selectedCalendars), from: Date(), to: Date().addingTimeInterval(30 * 86_400))) ?? []
    }
}
