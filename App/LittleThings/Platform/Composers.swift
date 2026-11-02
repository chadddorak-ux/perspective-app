import LTIntegrations
import MessageUI
import SwiftUI

/// System message composer with recipient and text visible for review. The user taps Send in
/// the system UI; LittleThings cannot send unattended through MessageUI. `.sent` means the
/// system accepted the message, not that it was delivered.
struct MessageComposer: UIViewControllerRepresentable {
    var recipients: [String]
    var body: String
    var onFinish: (ComposerResult) -> Void

    static var canSend: Bool { MFMessageComposeViewController.canSendText() }

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.recipients = recipients
        controller.body = body
        controller.messageComposeDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let onFinish: (ComposerResult) -> Void
        init(onFinish: @escaping (ComposerResult) -> Void) { self.onFinish = onFinish }

        func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
            switch result {
            case .sent: onFinish(.sent)
            case .cancelled: onFinish(.cancelled)
            case .failed: onFinish(.failed)
            @unknown default: onFinish(.failed)
            }
        }
    }
}

struct MailComposer: UIViewControllerRepresentable {
    var recipients: [String]
    var body: String
    var onFinish: (ComposerResult) -> Void

    static var canSend: Bool { MFMailComposeViewController.canSendMail() }

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let controller = MFMailComposeViewController()
        controller.setToRecipients(recipients)
        controller.setMessageBody(body, isHTML: false)
        controller.mailComposeDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMailComposeViewController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let onFinish: (ComposerResult) -> Void
        init(onFinish: @escaping (ComposerResult) -> Void) { self.onFinish = onFinish }

        func mailComposeController(_ controller: MFMailComposeViewController, didFinishWith result: MFMailComposeResult, error: Error?) {
            switch result {
            case .sent: onFinish(.sent)
            case .cancelled, .saved: onFinish(.cancelled)
            case .failed: onFinish(.failed)
            @unknown default: onFinish(.failed)
            }
        }
    }
}
