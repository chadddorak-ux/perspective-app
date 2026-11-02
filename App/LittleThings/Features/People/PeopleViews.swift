import LTAppCore
import LTDomain
import LTIntegrations
import SwiftUI

struct PeopleView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var circle: String?
    @State private var favoritesOnly = false
    @State private var showArchived = false
    @State private var showAdd = false
    @State private var showPicker = false
    @State private var showDuplicates = false

    var circles: [String] { Array(Set(model.snapshot.people.values.flatMap(\.circles))).sorted() }

    var people: [Person] {
        model.snapshot.people.values
            .filter { showArchived ? $0.isArchived : !$0.isArchived }
            .filter { !favoritesOnly || $0.isFavorite }
            .filter { circle == nil || $0.circles.contains(circle!) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            List {
                if !query.isEmpty {
                    Section("Results") {
                        ForEach(model.search(query)) { result in
                            NavigationLink {
                                if let id = result.personID { PersonDetailView(personID: id) }
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(result.title)
                                    Text(result.snippet).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                                }
                            }
                        }
                    }
                } else {
                    if !model.duplicateCandidates.isEmpty {
                        Button("Review \(model.duplicateCandidates.count) possible duplicate\(model.duplicateCandidates.count == 1 ? "" : "s")") { showDuplicates = true }
                    }
                    if people.isEmpty {
                        EmptyState(title: showArchived ? "No archived people" : "No one here yet", message: "Add someone you want to remember more about.", systemImage: "person.crop.circle.badge.plus", actionTitle: showArchived ? nil : "Add someone", action: showArchived ? nil : { showAdd = true })
                    }
                    ForEach(people) { person in
                        NavigationLink(value: person.id) {
                            HStack(spacing: 12) {
                                InitialsAvatar(name: person.name, size: 36)
                                VStack(alignment: .leading) {
                                    Text(person.name)
                                    Text([person.relationshipLabel, person.city].compactMap { $0 }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if person.reminderPreferences.isPaused { Image(systemName: "pause.circle").foregroundStyle(.secondary).accessibilityLabel("Paused") }
                                if person.isFavorite { Image(systemName: "star.fill").foregroundStyle(.yellow).accessibilityLabel("Favorite") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("People")
            .navigationDestination(for: PersonID.self) { PersonDetailView(personID: $0) }
            .searchable(text: $query, prompt: "Search people and notes")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Toggle("Favorites", isOn: $favoritesOnly)
                        Toggle("Archived", isOn: $showArchived)
                        Picker("Circle", selection: $circle) {
                            Text("All circles").tag(String?.none)
                            ForEach(circles, id: \.self) { Text($0).tag(Optional($0)) }
                        }
                    } label: { Label("Filter", systemImage: "line.3.horizontal.decrease.circle") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Add someone", systemImage: "square.and.pencil") { showAdd = true }
                        Button("Choose from Contacts", systemImage: "person.crop.circle.badge.plus") { showPicker = true }
                    } label: { Image(systemName: "plus") }
                    .accessibilityIdentifier("addPersonMenu")
                }
            }
            .sheet(isPresented: $showAdd) { NavigationStack { PersonEditView(person: nil) } }
            .sheet(isPresented: $showPicker) {
                ContactPicker(onPick: { contacts in showPicker = false; Task { try? await model.importContacts(contacts) } }, onCancel: { showPicker = false })
                    .ignoresSafeArea()
            }
            .sheet(isPresented: $showDuplicates) { NavigationStack { DuplicatesView() } }
        }
    }
}

struct PersonEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let person: Person?

    @State private var name = ""
    @State private var preferred = ""
    @State private var relationship = ""
    @State private var circles = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var city = ""
    @State private var address = ""
    @State private var preferences = ""
    @State private var notes = ""
    @State private var boundaries = ""
    @State private var cadence = 0

    var body: some View {
        Form {
            Section("Name") {
                TextField("Name", text: $name).accessibilityIdentifier("personNameField")
                TextField("Preferred name (optional)", text: $preferred)
                TextField("Relationship (optional)", text: $relationship)
                TextField("Circles, comma separated", text: $circles)
            }
            Section("Reach") {
                TextField("Phone", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("City", text: $city)
                TextField("Address (you enter it; never inferred)", text: $address, axis: .vertical)
                TextField("How they like to be contacted", text: $preferences)
            }
            Section("Notes") {
                TextField("Notes", text: $notes, axis: .vertical)
                TextField("Things to handle with care", text: $boundaries, axis: .vertical)
            }
            Section {
                Picker("Check-in reminder", selection: $cadence) {
                    Text("Off").tag(0)
                    Text("Every 2 weeks").tag(14)
                    Text("Every 3 weeks").tag(21)
                    Text("Monthly").tag(30)
                    Text("Every 2 months").tag(60)
                    Text("Quarterly").tag(90)
                }
            } footer: {
                Text("Based only on conversations you log or sources you connect.")
            }
        }
        .navigationTitle(person == nil ? "Add someone" : "Edit")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("savePersonButton")
            }
        }
        .onAppear(perform: load)
    }

    func load() {
        guard let p = person else { return }
        name = p.displayName; preferred = p.preferredName ?? ""; relationship = p.relationshipLabel ?? ""
        circles = p.circles.joined(separator: ", "); phone = p.phoneNumbers.first?.value ?? ""; email = p.emailAddresses.first?.value ?? ""
        city = p.city ?? ""; address = p.address ?? ""; preferences = p.communicationPreferences ?? ""; notes = p.notes ?? ""
        boundaries = p.boundaries ?? ""; cadence = p.reminderPreferences.cadenceDays ?? 0
    }

    func save() {
        var p = person ?? Person(displayName: name, createdAt: Date())
        p.displayName = name.trimmingCharacters(in: .whitespaces)
        p.preferredName = preferred.nilIfEmpty
        p.relationshipLabel = relationship.nilIfEmpty
        p.circles = circles.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        p.phoneNumbers = phone.nilIfEmpty.map { [LabeledValue(label: "mobile", value: $0)] } ?? []
        p.emailAddresses = email.nilIfEmpty.map { [LabeledValue(value: $0)] } ?? []
        p.city = city.nilIfEmpty
        p.address = address.nilIfEmpty
        p.communicationPreferences = preferences.nilIfEmpty
        p.notes = notes.nilIfEmpty
        p.boundaries = boundaries.nilIfEmpty
        p.reminderPreferences.cadenceDays = cadence == 0 ? nil : cadence
        Task {
            if person == nil { _ = try? await model.addPerson(p) } else { try? await model.updatePerson(p) }
            dismiss()
        }
    }
}

struct DuplicatesView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            ForEach(model.duplicateCandidates, id: \.self) { candidate in
                if let a = model.snapshot.people[candidate.first], let b = model.snapshot.people[candidate.second] {
                    Section {
                        Text("\(a.name) and \(b.name)")
                        Text(candidate.reasons.joined(separator: ", ")).font(.caption).foregroundStyle(.secondary)
                        Button("Keep \(a.name), merge the other in") { Task { try? await model.merge(keep: a.id, absorb: b.id) } }
                        Button("Keep \(b.name), merge the other in") { Task { try? await model.merge(keep: b.id, absorb: a.id) } }
                    } footer: {
                        Text("Notes, dates and reminders are preserved. You can undo until you leave the app.")
                    }
                }
            }
            if model.canUndoMerge {
                Button("Undo last merge") { Task { try? await model.undoLastMerge() } }
            }
        }
        .navigationTitle("Possible duplicates")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }
}
