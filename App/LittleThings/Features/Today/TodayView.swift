import LTAppCore
import LTDomain
import LTIntelligence
import LTSuggestions
import SwiftUI

struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var whyCard: SuggestionCard?
    @State private var draftCard: SuggestionCard?
    @State private var briefLink: CalendarLinkID?
    @State private var attendanceCard: SuggestionCard?
    @State private var baselineCard: SuggestionCard?
    @State private var giftCard: SuggestionCard?
    @State private var showMore = false
    @State private var showReview = false
    @State private var showBackup = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    if model.snapshot.activePeople.isEmpty {
                        GetStartedView()
                    } else if model.today.visible.isEmpty {
                        EmptyState(title: "Nothing needs you today", message: "LittleThings will surface a few moments when they matter. You can always add a memory.", systemImage: "leaf")
                    }

                    if !model.reviewQueue.isEmpty {
                        Button { showReview = true } label: {
                            Label("\(model.reviewQueue.count) detail\(model.reviewQueue.count == 1 ? "" : "s") to review", systemImage: "checklist")
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("reviewQueueButton")
                    }

                    ForEach(model.today.visible) { card in
                        SuggestionCardView(card: card, personName: model.snapshot.people[card.personID]?.name ?? "", onAction: { handle($0, card) }, onWhy: { whyCard = card })
                    }

                    if !model.today.visible.isEmpty { prompts }

                    if !model.today.more.isEmpty {
                        DisclosureGroup("More upcoming (\(model.today.more.count))", isExpanded: $showMore) {
                            VStack(spacing: 12) {
                                ForEach(model.today.more) { card in
                                    SuggestionCardView(card: card, personName: model.snapshot.people[card.personID]?.name ?? "", onAction: { handle($0, card) }, onWhy: { whyCard = card })
                                }
                            }
                            .padding(.top, 8)
                        }
                        .accessibilityIdentifier("moreUpcoming")
                    }
                }
                .padding()
            }
            .background(Palette.background)
            .navigationTitle("Today")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { AddMenu() } }
            .refreshable { await model.refresh() }
            .sheet(item: $whyCard) { card in NavigationStack { WhyThisAppearedView(card: card) } }
            .sheet(item: $draftCard) { card in NavigationStack { DraftView(card: card) } }
            .sheet(item: Binding(get: { briefLink.map(LinkBox.init) }, set: { briefLink = $0?.id })) { box in
                NavigationStack { BriefView(linkID: box.id) }
            }
            .sheet(item: $baselineCard) { card in NavigationStack { BaselineView(personID: card.personID) } }
            .sheet(item: $giftCard) { card in NavigationStack { AddGiftView(personID: card.personID) } }
            .sheet(isPresented: $showReview) { NavigationStack { ReviewQueueView() } }
            .sheet(isPresented: $showBackup) { NavigationStack { BackupView() } }
            .confirmationDialog("Did it happen?", isPresented: Binding(get: { attendanceCard != nil }, set: { if !$0 { attendanceCard = nil } }), titleVisibility: .visible, presenting: attendanceCard) { card in
                Button("Yes, we met") { confirmAttendance(card, happened: true) }
                Button("No, it didn't happen") { confirmAttendance(card, happened: false) }
            } message: { _ in
                Text("Only a confirmed meeting is logged as time together.")
            }
        }
    }

    /// Permission and backup prompts appear only after a useful card exists.
    @ViewBuilder var prompts: some View {
        if !model.isDemo && !model.snapshot.preferences.notificationPermissionRequested {
            VStack(alignment: .leading, spacing: 8) {
                Text("Want a heads-up on the day?").font(.headline)
                Text("Reminders stay generic on the lock screen — \u{201C}You have a relationship reminder\u{201D} — unless you choose otherwise in Settings.")
                    .font(.subheadline).foregroundStyle(.secondary)
                HStack {
                    Button("Turn on reminders") { Task { await model.requestNotificationPermission() } }
                        .buttonStyle(.borderedProminent)
                    Button("Not now") {
                        var p = model.snapshot.preferences
                        p.notificationPermissionRequested = true
                        Task { try? await model.updatePreferences(p) }
                    }
                }
            }
            .padding()
            .background(Palette.card, in: RoundedRectangle(cornerRadius: 16))
        } else if !model.isDemo && !model.snapshot.preferences.backupPromptShown && model.snapshot.preferences.lastBackupAt == nil {
            VStack(alignment: .leading, spacing: 8) {
                Text("Set up a backup").font(.headline)
                Text("Records live only on this iPhone. If it's lost without an encrypted backup, they can't be recovered.")
                    .font(.subheadline).foregroundStyle(.secondary)
                HStack {
                    Button("Back up now") { showBackup = true }.buttonStyle(.borderedProminent)
                    Button("Later") {
                        var p = model.snapshot.preferences
                        p.backupPromptShown = true
                        Task { try? await model.updatePreferences(p) }
                    }
                }
            }
            .padding()
            .background(Palette.card, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    func handle(_ action: CardAction, _ card: SuggestionCard) {
        switch action {
        case .draftMessage: draftCard = card
        case .review: whyCard = card
        case .openBrief: briefLink = linkID(card)
        case .confirmAttendance: attendanceCard = card
        case .setBaseline: baselineCard = card
        case .planGift: giftCard = card
        default: Task { try? await model.perform(action, on: card) }
        }
    }

    func linkID(_ card: SuggestionCard) -> CalendarLinkID? {
        for ref in card.evidence { if case .calendarLink(let id) = ref { return id } }
        return nil
    }

    func confirmAttendance(_ card: SuggestionCard, happened: Bool) {
        guard let id = linkID(card) else { return }
        Task { try? await model.confirmAttendance(id, happened: happened) }
        attendanceCard = nil
    }
}

struct LinkBox: Identifiable { let id: CalendarLinkID }

/// "Why this appeared": the reason, dated evidence and coverage, with a way to correct.
struct WhyThisAppearedView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let card: SuggestionCard

    var body: some View {
        List {
            Section { Text(card.explanation.reason) } header: { Text("Why") }
            if !card.explanation.items.isEmpty {
                Section("Based on") {
                    ForEach(Array(card.explanation.items.enumerated()), id: \.offset) { _, item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.label).font(.caption).foregroundStyle(.secondary)
                            Text(item.text)
                            if let date = item.date {
                                Text(date, format: .dateTime.month().day().year()).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            if let coverage = card.explanation.coverage {
                Section("What LittleThings can see") {
                    Text(coverage)
                    Text("LittleThings only sees sources you connected. You may have talked in ways it can't see.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Section {
                NavigationLink("Open \(model.snapshot.people[card.personID]?.name ?? "person")") {
                    PersonDetailView(personID: card.personID)
                }
                Button("Not useful — dismiss", role: .destructive) {
                    Task { try? await model.perform(.dismiss, on: card); dismiss() }
                }
            } footer: {
                Text("To correct a detail, open the person and edit or delete the source note.")
            }
        }
        .navigationTitle("Why this appeared")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }
}

struct BriefView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let linkID: CalendarLinkID

    var body: some View {
        List {
            if let brief = model.brief(for: linkID) {
                Section { Text(brief.heading).font(.headline) } footer: { Text("This is a scheduled event; it isn't logged until you confirm it happened.") }
                ForEach(brief.sections, id: \.title) { section in
                    Section(section.title) {
                        ForEach(section.lines, id: \.text) { Text($0.text) }
                    }
                }
                if brief.sections.isEmpty {
                    Text("No saved details yet for this person.").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Before you meet")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }
}

struct BaselineView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let personID: PersonID
    @State private var date = Date()

    var body: some View {
        Form {
            Section {
                DatePicker("Last caught up", selection: $date, in: ...Date(), displayedComponents: .date)
            } footer: {
                Text("This gives check-in reminders a real starting point instead of a guess.")
            }
        }
        .navigationTitle("Starting point")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { try? await model.setBaseline(for: personID, lastCaughtUp: CalendarDay(date)); dismiss() }
                }
            }
        }
    }
}
