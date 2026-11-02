import LTAppCore
import LTDomain
import LTIntegrations
import LTIntelligence
import LTPolicy
import LTSuggestions
import SwiftUI
import UIKit

/// Draft review. Recipient and text are always visible before handoff. Nothing is sent from
/// here: Messages/Mail open with the text for the user to send, or the user shares/copies it.
struct DraftView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let card: SuggestionCard

    @State private var draft: Draft?
    @State private var tone: DraftTone = .warm
    @State private var selected: Set<EvidenceRef> = []
    @State private var allowSensitive: Set<EvidenceRef> = []
    @State private var text = ""
    @State private var recipientIndex = 0
    @State private var showComposer = false
    @State private var askDidSend = false
    @State private var policyMessage: String?

    var person: Person? { model.snapshot.people[card.personID] }

    var recipients: [DraftRecipient] {
        guard let person else { return [] }
        return person.phoneNumbers.map { DraftRecipient(personID: person.id, channel: .sms, address: $0.value) }
            + person.emailAddresses.map { DraftRecipient(personID: person.id, channel: .email, address: $0.value) }
    }

    var recipient: DraftRecipient? { recipients.indices.contains(recipientIndex) ? recipients[recipientIndex] : nil }

    var body: some View {
        Form {
            Section("To") {
                if recipients.isEmpty {
                    Text("No phone number or email saved for \(person?.name ?? "this person"). You can still share or copy the text.")
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Recipient", selection: $recipientIndex) {
                        ForEach(recipients.indices, id: \.self) { i in
                            Text("\(person?.name ?? "") · \(recipients[i].address ?? "")").tag(i)
                        }
                    }
                    .accessibilityIdentifier("recipientPicker")
                }
            }
            Section("Tone") {
                Picker("Tone", selection: $tone) {
                    ForEach(DraftTone.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            let context = model.draftContext(for: card.personID)
            if !context.isEmpty {
                Section {
                    ForEach(context, id: \.evidence) { item in
                        Toggle(isOn: binding(for: item)) {
                            VStack(alignment: .leading) {
                                Text(item.phrase)
                                if item.isSensitive { Text("Sensitive — only included if you turn this on").font(.caption).foregroundStyle(.orange) }
                            }
                        }
                    }
                } header: {
                    Text("Include a detail (optional)")
                } footer: {
                    Text("Only details you confirmed are offered. Nothing from other people is used.")
                }
            }
            Section("Message") {
                TextEditor(text: $text)
                    .frame(minHeight: 120)
                    .accessibilityIdentifier("draftText")
            }
            if let policyMessage {
                Section { Text(policyMessage).foregroundStyle(.orange) }
            }
            Section {
                if let recipient, recipient.channel == .sms, MessageComposer.canSend {
                    Button("Open in Messages") { handOff() }.accessibilityIdentifier("openInMessages")
                } else if let recipient, recipient.channel == .email, MailComposer.canSend {
                    Button("Open in Mail") { handOff() }
                }
                ShareLink(item: text) { Text("Share…") }
                    .simultaneousGesture(TapGesture().onEnded { markHandedOff() })
                Button("Copy text") {
                    UIPasteboard.general.string = text // only on this explicit tap
                    markHandedOff()
                }
            } footer: {
                Text("You'll review and send it yourself. LittleThings can't confirm delivery.")
            }
        }
        .navigationTitle("Draft")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    if let draft { Task { try? await model.recordComposerResult(.cancelled, for: draft.id) } }
                    dismiss()
                }
                .accessibilityIdentifier("cancelDraft")
            }
        }
        .task { await regenerate() }
        .onChange(of: tone) { Task { await regenerate() } }
        .onChange(of: selected) { Task { await regenerate() } }
        .sheet(isPresented: $showComposer) {
            if let recipient, let draft {
                if recipient.channel == .email {
                    MailComposer(recipients: [recipient.address ?? ""], body: text) { finish($0, draft) }
                } else {
                    MessageComposer(recipients: [recipient.address ?? ""], body: text) { finish($0, draft) }
                }
            }
        }
        .alert("Did you send it?", isPresented: $askDidSend) {
            Button("Yes, I sent it") { confirmSent(true) }
            Button("No", role: .cancel) { confirmSent(false) }
        } message: {
            Text("LittleThings only logs a message when you confirm it was sent.")
        }
    }

    func binding(for item: DraftContextItem) -> Binding<Bool> {
        Binding(get: { selected.contains(item.evidence) }, set: { on in
            if on { selected.insert(item.evidence); if item.isSensitive { allowSensitive.insert(item.evidence) } }
            else { selected.remove(item.evidence); allowSensitive.remove(item.evidence) }
        })
    }

    func regenerate() async {
        let items = model.draftContext(for: card.personID).filter { selected.contains($0.evidence) }
        guard var current = draft else {
            draft = try? await model.makeDraft(for: card, tone: tone, selected: items, allowSensitive: allowSensitive)
            text = draft?.text ?? ""
            return
        }
        let composed = DraftComposer().compose(occasion: model.occasion(for: card), name: person?.name ?? "", tone: tone, selected: items, explicitlyAllowedSensitive: allowSensitive)
        current.tone = tone
        current.evidence = composed.usedEvidence
        current.text = composed.text
        text = composed.text
        draft = current
        try? await model.updateDraft(current)
    }

    func currentDraft() -> Draft? {
        guard var d = draft else { return nil }
        d.text = text
        d.recipient = recipient
        return d
    }

    func handOff() {
        guard let d = currentDraft() else { return }
        switch model.prepareHandoff(d) {
        case .execute:
            policyMessage = nil
            Task { try? await model.updateDraft(d) }
            showComposer = true
        case .requireReview(let reasons), .deny(let reasons):
            policyMessage = reasons.joined(separator: " ")
        case .expired:
            policyMessage = "This draft expired. Please review it again."
        }
    }

    func finish(_ result: ComposerResult, _ draft: Draft) {
        showComposer = false
        Task {
            try? await model.recordComposerResult(result, for: draft.id)
            if result == .sent { dismiss() }
        }
    }

    func markHandedOff() {
        guard let d = currentDraft() else { return }
        Task { try? await model.updateDraft(d); try? await model.markHandedOff(d.id) }
        askDidSend = true
    }

    func confirmSent(_ sent: Bool) {
        guard let d = draft else { return }
        Task { try? await model.confirmDraftSent(d.id, sent: sent); if sent { dismiss() } }
    }
}
