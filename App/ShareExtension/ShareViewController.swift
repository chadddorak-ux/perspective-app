import CryptoKit
import LTCapture
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Share extension: an explicit, user-initiated capture route (FR12).
///
/// The extension never opens the vault and never holds a private key. It seals what the user
/// shared to the main app's public key (HPKE) and writes an opaque file into the App Group
/// inbox. The main app opens it, saves it as a source, and asks the user to review.
/// UNVERIFIED: not compiled or run in this environment.
final class ShareViewController: UIViewController {
    private let status = ShareStatus()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareStatusView(status: status) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        })
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
        Task { await capture() }
    }

    private var appGroupDirectory: URL? {
        guard let id = Bundle.main.object(forInfoDictionaryKey: "LTAppGroupIdentifier") as? String else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    @MainActor
    private func capture() async {
        guard let dir = appGroupDirectory,
              let keyData = try? Data(contentsOf: dir.appendingPathComponent("inbox-public-key")),
              let publicKey = try? Curve25519.KeyAgreement.PublicKey(rawRepresentation: keyData) else {
            status.state = .needsSetup
            return
        }
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        var item = InboxItem(receivedAt: Date())
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier), let file = await loadFile(provider) {
                guard file.data.count <= ShareInbox.maximumPayloadBytes else { status.state = .tooLarge; return }
                item.fileName = file.name
                item.fileData = file.data
            } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier), let url = await loadURL(provider) {
                item.url = url
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier), let text = await loadText(provider) {
                item.text = [item.text, text].compactMap { $0 }.joined(separator: "\n")
            }
        }
        guard item.text != nil || item.url != nil || item.fileData != nil else {
            status.state = .nothing
            return
        }
        do {
            let inbox = dir.appendingPathComponent("ShareInbox", isDirectory: true)
            try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
            let sealed = try ShareInbox.seal(item, to: publicKey)
            try sealed.write(to: inbox.appendingPathComponent(ShareInbox.fileName(for: item)), options: [.atomic, .completeFileProtectionUnlessOpen])
            status.state = .saved
        } catch {
            status.state = .failed
        }
    }

    // Completion-handler APIs keep the non-Sendable NSItemProvider on the main actor and
    // hand back only Sendable values. File contents are read inside the handler, while the
    // provided URL is guaranteed to be valid.
    private func loadText(_ provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                continuation.resume(returning: item as? String)
            }
        }
    }

    private func loadURL(_ provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                continuation.resume(returning: item as? URL)
            }
        }
    }

    private func loadFile(_ provider: NSItemProvider) async -> (name: String, data: Data)? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                guard let url = item as? URL, let data = try? Data(contentsOf: url) else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: (url.lastPathComponent, data))
            }
        }
    }
}

@MainActor
final class ShareStatus: ObservableObject {
    enum State { case working, saved, needsSetup, nothing, tooLarge, failed }
    @Published var state: State = .working
}

struct ShareStatusView: View {
    @ObservedObject var status: ShareStatus
    var done: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            switch status.state {
            case .working: ProgressView("Saving…")
            case .saved:
                Image(systemName: "checkmark.circle.fill").font(.largeTitle).foregroundStyle(.green)
                Text("Saved to LittleThings").font(.headline)
                Text("Open LittleThings to choose who it's about and review any details. It stays encrypted on this iPhone.")
                    .multilineTextAlignment(.center).foregroundStyle(.secondary)
            case .needsSetup:
                Text("Open LittleThings once to finish setup, then share again.").multilineTextAlignment(.center)
            case .nothing:
                Text("There was nothing to save.").foregroundStyle(.secondary)
            case .tooLarge:
                Text("That file is too large to save.").foregroundStyle(.secondary)
            case .failed:
                Text("Couldn't save. Please try again.").foregroundStyle(.secondary)
            }
            if status.state != .working { Button("Done", action: done).buttonStyle(.borderedProminent) }
        }
        .padding(24)
    }
}
