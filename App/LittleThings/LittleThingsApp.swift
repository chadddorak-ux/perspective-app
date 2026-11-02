import LTAppCore
import LTIntelligence
import SwiftUI

@main
struct LittleThingsApp: App {
    @State private var model = AppModel(environment: LiveEnvironment.make())
    @State private var obscured = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Palette.accent)
                .overlay {
                    if obscured { PrivacyShield().transition(.opacity) }
                }
                .task {
                    model.start()
                    if model.phase == .locked { await model.unlock() }
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        obscured = false
                        Task { await model.willEnterForeground() }
                    case .inactive:
                        obscured = true
                    case .background:
                        obscured = true
                        model.didEnterBackground()
                    @unknown default:
                        obscured = true
                    }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.phase {
        case .starting:
            ProgressView().accessibilityLabel("Starting")
        case .onboarding:
            OnboardingView()
        case .protectionRequired(let message):
            ProtectionRequiredView(message: message)
        case .locked:
            LockView()
        case .failed(let message):
            VaultFailedView(message: message)
        case .ready:
            MainTabView()
        }
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var model
    @State private var pendingCaptures: [MemoryCapture] = []
    @State private var importCandidate = false

    var body: some View {
        VStack(spacing: 0) {
            if model.isDemo {
                DemoBanner { Task { await model.exitDemo() } }
            }
            TabView {
                Tab("Today", systemImage: "sun.max") { TodayView() }
                Tab("People", systemImage: "person.2") { PeopleView() }
                Tab("Upcoming", systemImage: "calendar") { UpcomingView() }
                Tab("Settings", systemImage: "gearshape") { SettingsView() }
            }
        }
        .background(Palette.background)
        .task(id: model.phase) {
            guard model.phase == .ready, !model.isDemo else { return }
            LiveEnvironment.publishShareInboxKey(from: model)
            pendingCaptures = await model.drainShareInbox()
        }
        .sheet(item: Binding(get: { pendingCaptures.first.map(CaptureBox.init) }, set: { if $0 == nil, !pendingCaptures.isEmpty { pendingCaptures.removeFirst() } })) { box in
            NavigationStack { ProposalReviewView(capture: box.capture, allowsLinkingPeople: true) }
        }
    }
}

struct CaptureBox: Identifiable, Hashable {
    let capture: MemoryCapture
    var id: String { capture.source.id.uuidString }
    static func == (lhs: CaptureBox, rhs: CaptureBox) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct LockView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.fill").font(.system(size: 44)).foregroundStyle(Palette.accent)
            Text("LittleThings is locked").font(.title2.weight(.semibold))
            Text("Your vault is encrypted on this iPhone.").foregroundStyle(.secondary)
            if let error = model.lastError {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
            Button("Unlock") { Task { await model.unlock() } }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("unlockButton")
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
    }
}

struct ProtectionRequiredView: View {
    @Environment(AppModel.self) private var model
    let message: String

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.trianglebadge.exclamationmark").font(.system(size: 44)).foregroundStyle(.orange)
            Text("A device passcode is needed").font(.title2.weight(.semibold))
            Text(message).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("I've set a passcode — try again") { Task { await model.createVault() } }
                .buttonStyle(.borderedProminent)
            Button("Explore the demo") { Task { await model.startDemo() } }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
    }
}

struct VaultFailedView: View {
    @Environment(AppModel.self) private var model
    let message: String
    @State private var confirmDelete = false

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.lock").font(.system(size: 44)).foregroundStyle(.red)
            Text("The vault can't be opened").font(.title2.weight(.semibold))
            Text(message).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Text("Nothing is shown unencrypted. You can delete this vault and start over, then restore from a backup if you have one.")
                .font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Delete vault and start over", role: .destructive) { confirmDelete = true }
        }
        .padding()
        .confirmationDialog("Delete the vault on this iPhone?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await model.deleteEverything() } }
        }
    }
}
