import LTAppCore
import LTDomain
import LTIntegrations
import SwiftUI

/// First session (PRD section 4): explain locality, create the vault, choose people, offer
/// sources honestly, and only then ask for notifications (from Today, after a useful card).
struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var creating = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Remember the little things.\nShow up for the big ones.")
                        .font(.largeTitle.weight(.bold))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)

                    promise(icon: "iphone", title: "Saved on this iPhone", text: "Everything you add is stored in an encrypted vault on this device. There's no LittleThings account or server.")
                    promise(icon: "cpu", title: "AI stays local", text: "When your iPhone supports on-device AI, notes are processed here. There is never a cloud fallback. Without it, you can still type details yourself.")
                    promise(icon: "paperplane", title: "You choose every action", text: "Messages open in Messages or Mail for you to review and send. LittleThings never sends, buys or shares anything on its own.")
                    promise(icon: "faceid", title: "Locked with your device", text: "Face ID, Touch ID or your passcode unlocks the vault. If you lose this iPhone without a backup, your records can't be recovered.")

                    Button {
                        creating = true
                        Task { await model.createVault(); creating = false }
                    } label: {
                        Text(creating ? "Creating your vault…" : "Create my private vault")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(creating)
                    .accessibilityIdentifier("createVaultButton")

                    Button("Explore the demo first") { Task { await model.startDemo() } }
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("startDemoButton")
                }
                .padding(24)
            }
            .background(Palette.background)
        }
    }

    func promise(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(Palette.accent)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Shown on an empty Today: choose a few people first. Manual entry works without permission.
struct GetStartedView: View {
    @Environment(AppModel.self) private var model
    @State private var showContactPicker = false
    @State private var showAddPerson = false
    @State private var showSources = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add someone you want to remember more about.")
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Text("Start with a few people — five to twenty works well, but one is fine.")
                .foregroundStyle(.secondary)
            Button {
                showContactPicker = true
            } label: {
                Label("Choose from Contacts", systemImage: "person.crop.circle.badge.plus").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("chooseContactsButton")
            Text("The contact picker shares only the people you select. No Contacts permission is needed.")
                .font(.footnote).foregroundStyle(.secondary)
            Button {
                showAddPerson = true
            } label: {
                Label("Add someone by hand", systemImage: "square.and.pencil").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("addPersonManuallyButton")
            Button("See which sources can help") { showSources = true }
                .font(.footnote)
        }
        .padding()
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showContactPicker) {
            ContactPicker(onPick: { contacts in
                showContactPicker = false
                Task { try? await model.importContacts(contacts) }
            }, onCancel: { showContactPicker = false })
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showAddPerson) { NavigationStack { PersonEditView(person: nil) } }
        .sheet(isPresented: $showSources) { NavigationStack { SourcesView() } }
    }
}
