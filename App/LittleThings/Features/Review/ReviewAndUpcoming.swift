import LTAppCore
import LTDomain
import SwiftUI

/// Source-derived records waiting for a decision. Nothing here triggers reminders until confirmed.
struct ReviewQueueView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if model.reviewQueue.isEmpty {
                Text("Nothing to review.").foregroundStyle(.secondary)
            }
            ForEach(model.reviewQueue) { item in
                VStack(alignment: .leading, spacing: 6) {
                    Text(title(for: item))
                    if let excerpt = excerpt(for: item) { Text("“\(excerpt)”").font(.caption).foregroundStyle(.secondary) }
                    HStack {
                        if case .leapDayChoice = item {
                            Button("Feb 28") { resolve(item, true, .february28) }.buttonStyle(.bordered)
                            Button("Mar 1") { resolve(item, true, .march1) }.buttonStyle(.bordered)
                        } else {
                            Button("Confirm") { resolve(item, true, nil) }.buttonStyle(.borderedProminent)
                            Button("Dismiss") { resolve(item, false, nil) }.buttonStyle(.bordered)
                        }
                    }
                    .controlSize(.small)
                }
                .accessibilityElement(children: .contain)
            }
        }
        .navigationTitle("Review")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }

    func resolve(_ item: ReviewItem, _ accept: Bool, _ leap: LeapDayPolicy?) {
        Task { try? await model.resolve(item, accept: accept, leapDayPolicy: leap) }
    }

    func name(_ id: PersonID) -> String { model.snapshot.people[id]?.name ?? "Someone" }

    func title(for item: ReviewItem) -> String {
        let s = model.snapshot
        switch item {
        case .fact(let id): return s.facts[id].map { "\(name($0.personID)) — \($0.label): \($0.value)" } ?? ""
        case .date(let id):
            return s.importantDates[id].map { date in
                let conflict = date.confirmation == .disputed ? " — differs from another saved \(date.label.lowercased()); keep one" : ""
                return "\(name(date.personID)) — \(date.label)\(conflict)"
            } ?? ""
        case .leapDayChoice(let id): return s.importantDates[id].map { "\(name($0.personID)) — \($0.label) is Feb 29. Which day in other years?" } ?? ""
        case .promise(let id): return s.promises[id].map { $0.description } ?? ""
        case .lifeEvent(let id): return s.lifeEvents[id].map { "\(name($0.personID)) — \($0.summary)" + ($0.eventDay == nil ? " (no date)" : "") } ?? ""
        }
    }

    func excerpt(for item: ReviewItem) -> String? {
        let s = model.snapshot
        switch item {
        case .fact(let id): return s.facts[id]?.excerpt
        case .date(let id), .leapDayChoice(let id): return s.importantDates[id]?.excerpt
        case .promise(let id): return s.promises[id]?.excerpt
        case .lifeEvent(let id): return s.lifeEvents[id]?.excerpt.nilIfEmpty
        }
    }
}

/// Chronological list plus an accessible month grid of confirmed dates and planned actions.
struct UpcomingView: View {
    @Environment(AppModel.self) private var model
    @State private var showCalendar = false

    var body: some View {
        NavigationStack {
            let items = model.upcoming(days: 90)
            List {
                if showCalendar {
                    MonthGrid(items: items)
                }
                if items.isEmpty {
                    EmptyState(title: "Nothing coming up", message: "Confirmed dates, promises with due dates, linked events and trips appear here.", systemImage: "calendar")
                }
                ForEach(groupedDays(items)) { group in
                    Section(group.day.date.formatted(.dateTime.weekday(.wide).month().day())) {
                        ForEach(group.items) { item in
                            HStack {
                                Image(systemName: icon(item.kind)).foregroundStyle(Palette.accent).accessibilityHidden(true)
                                VStack(alignment: .leading) {
                                    Text(item.title)
                                    if let detail = item.detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
                                }
                                if item.isSensitive { Spacer(); Image(systemName: "lock").foregroundStyle(.secondary).accessibilityLabel("Private") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Upcoming")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(showCalendar ? "List" : "Calendar") { showCalendar.toggle() }
                }
                ToolbarItem(placement: .topBarTrailing) { AddMenu() }
            }
        }
    }

    struct DayGroup: Identifiable {
        let day: CalendarDay
        let items: [UpcomingItem]
        var id: CalendarDay { day }
    }

    func groupedDays(_ items: [UpcomingItem]) -> [DayGroup] {
        Dictionary(grouping: items, by: \.day).sorted { $0.key < $1.key }.map { DayGroup(day: $0.key, items: $0.value) }
    }

    func icon(_ kind: UpcomingItem.Kind) -> String {
        switch kind {
        case .date: return "gift"
        case .promise: return "checkmark.circle"
        case .event: return "calendar"
        case .trip: return "airplane"
        }
    }
}

struct MonthGrid: View {
    let items: [UpcomingItem]
    var today: CalendarDay { CalendarDay(Date()) }

    var body: some View {
        let start = CalendarDay(today.year, today.month, 1)
        let days = CalendarDay.daysInMonth(year: start.year, month: start.month)
        let leading = start.weekday - 1
        let counts = Dictionary(grouping: items.filter { $0.day.year == start.year && $0.day.month == start.month }, by: { $0.day.day }).mapValues(\.count)
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
            ForEach(0..<leading, id: \.self) { _ in Color.clear.frame(height: 32) }
            ForEach(1...days, id: \.self) { day in
                let count = counts[day] ?? 0
                VStack(spacing: 2) {
                    Text("\(day)").font(.footnote).fontWeight(day == today.day ? .bold : .regular)
                    Circle().fill(count > 0 ? Palette.accent : .clear).frame(width: 5, height: 5)
                }
                .frame(height: 32)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(CalendarDay(start.year, start.month, day).date.formatted(.dateTime.month().day())), \(count == 0 ? "nothing planned" : "\(count) item\(count == 1 ? "" : "s")")")
            }
        }
        .padding(.vertical, 8)
    }
}
