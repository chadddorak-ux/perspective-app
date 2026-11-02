import LTDomain
import LTSuggestions
import SwiftUI
import UIKit

/// Warm neutral surfaces, restrained color, native controls; adapts to dark mode.
enum Palette {
    static let background = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.10, green: 0.09, blue: 0.08, alpha: 1)
        : UIColor(red: 0.98, green: 0.965, blue: 0.94, alpha: 1) })
    static let card = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.16, green: 0.15, blue: 0.13, alpha: 1)
        : UIColor(red: 1.0, green: 0.995, blue: 0.985, alpha: 1) })
    static let hairline = Color.primary.opacity(0.08)
    static let accent = Color.accentColor
    static let gentle = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.62, green: 0.70, blue: 0.80, alpha: 1)
        : UIColor(red: 0.33, green: 0.42, blue: 0.53, alpha: 1) })
}

struct InitialsAvatar: View {
    let name: String
    var size: CGFloat = 40

    var initials: String {
        let letters = name.split(separator: " ").prefix(2).compactMap(\.first).map { String($0).uppercased() }
        return letters.isEmpty ? "?" : letters.joined()
    }

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
            .foregroundStyle(Palette.accent)
            .frame(width: size, height: size)
            .background(Palette.accent.opacity(0.14), in: Circle())
            .accessibilityHidden(true)
    }
}

struct EmptyState: View {
    let title: String
    let message: String
    let systemImage: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(message)
        } actions: {
            if let actionTitle, let action {
                Button(actionTitle, action: action).buttonStyle(.borderedProminent)
            }
        }
    }
}

/// Opaque cover shown whenever the app is inactive so the app-switcher snapshot never shows
/// relationship content.
struct PrivacyShield: View {
    var body: some View {
        ZStack {
            Palette.background.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "lock.fill").font(.largeTitle)
                Text("LittleThings").font(.headline)
            }
            .foregroundStyle(.secondary)
        }
        .accessibilityLabel("LittleThings is hidden")
    }
}

struct DemoBanner: View {
    var exit: () -> Void
    var body: some View {
        HStack {
            Label("Demo — synthetic people only", systemImage: "theatermasks")
                .font(.footnote.weight(.semibold))
            Spacer()
            Button("Exit demo", action: exit).font(.footnote)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.yellow.opacity(0.25))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("demoBanner")
    }
}

/// A Today card: person, why it appeared, supporting detail and concrete actions.
struct SuggestionCardView: View {
    let card: SuggestionCard
    let personName: String
    var onAction: (CardAction) -> Void
    var onWhy: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                InitialsAvatar(name: personName)
                VStack(alignment: .leading, spacing: 4) {
                    Text(card.title)
                        .font(.body.weight(.semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    if let detail = card.detail {
                        Text(detail)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Button(action: onWhy) {
                Label("Why this appeared", systemImage: "info.circle")
                    .font(.footnote)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Palette.gentle)
            .accessibilityHint("Shows the saved details behind this suggestion")

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { actionButtons }
                VStack(alignment: .leading, spacing: 8) { actionButtons }
            }
        }
        .padding()
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Palette.hairline))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("card-\(card.ruleID.rawValue)")
    }

    @ViewBuilder var actionButtons: some View {
        ForEach(primaryActions, id: \.self) { action in
            Button(title(for: action)) { onAction(action) }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityIdentifier("cardAction-\(action.rawValue)")
        }
        Menu {
            ForEach(secondaryActions, id: \.self) { action in
                Button(title(for: action)) { onAction(action) }
            }
        } label: {
            Image(systemName: "ellipsis.circle").imageScale(.large)
        }
        .accessibilityLabel("More actions")
    }

    var primaryActions: [CardAction] {
        Array(card.actions.filter { ![.snooze, .dismiss, .done, .review].contains($0) }.prefix(2))
    }

    var secondaryActions: [CardAction] {
        card.actions.filter { !primaryActions.contains($0) }
    }

    func title(for action: CardAction) -> String {
        switch action {
        case .review: return "Review"
        case .draftMessage: return card.allowsCelebration ? "Draft a message" : "Write a note"
        case .planGift: return "Plan a gift"
        case .remindTonight: return "Remind me tonight"
        case .snooze: return "Snooze until tomorrow"
        case .dismiss: return "Dismiss"
        case .done: return "Done"
        case .logCatchUp: return "We caught up"
        case .confirmAttendance: return "Did it happen?"
        case .setBaseline: return "Set a starting point"
        case .openBrief: return "Open brief"
        }
    }
}

extension CalendarDay {
    var date: Date { date(at: TimeOfDay(hour: 12), in: .current) }

    init(_ date: Date) {
        self.init(date: date, timeZone: .current)
    }
}
