import Foundation
import LTDomain

/// Feasibility status values from FR12.
public enum FeasibilityStatus: String, Codable, Sendable, CaseIterable {
    case verified
    case prototype
    case blocked
    case unavailable
    case notInvestigated = "not investigated"
}

/// true / false / "partial" / "unknown" as recorded in the matrix.
public enum TriState: Codable, Sendable, Hashable {
    case yes
    case no
    case partial
    case unknown

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            self = bool ? .yes : .no
            return
        }
        switch try container.decode(String.self) {
        case "partial": self = .partial
        default: self = .unknown
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .yes: try container.encode(true)
        case .no: try container.encode(false)
        case .partial: try container.encode("partial")
        case .unknown: try container.encode("unknown")
        }
    }
}

/// One researched route from docs/integrations/capability-matrix.json.
public struct CapabilityEntry: Codable, Sendable, Hashable, Identifiable {
    public var id: String
    public var channel: String
    public var route: String
    public var status: FeasibilityStatus
    public var requiredPermission: String
    public var dataScope: String
    public var historicalCoverage: String
    public var refreshCadence: String
    public var restrictions: String
    public var onDeviceFeasible: TriState
    public var backendRequired: TriState
    public var nextExperiment: String
    public var docs: [String]
    public var verifiedOn: String?
    public var evidenceNotes: String
    public var testedInApp: Bool

    enum CodingKeys: String, CodingKey {
        case id, channel, route, status, docs
        case requiredPermission = "required_permission"
        case dataScope = "data_scope"
        case historicalCoverage = "historical_coverage"
        case refreshCadence = "refresh_cadence"
        case restrictions
        case onDeviceFeasible = "on_device_feasible"
        case backendRequired = "backend_required"
        case nextExperiment = "next_experiment"
        case verifiedOn = "verified_on"
        case evidenceNotes = "evidence_notes"
        case testedInApp = "tested_in_app"
    }
}

/// What this build actually implements for a route. Separate from research status so the
/// app never shows a Connect action for something it cannot do.
public enum ImplementationState: String, Sendable, Hashable {
    /// Implemented and usable in this build (still subject to device verification).
    case implemented
    /// Implemented as an explicit user-initiated import, never as monitoring.
    case manualImport
    /// Not implemented in this build.
    case notImplemented
}

/// Per-device runtime state for an implemented route.
public struct DeviceCapabilityState: Sendable, Hashable {
    public var permission: PermissionState?
    public var lastSuccessfulRefresh: Date?
    public var lastError: String?

    public init(permission: PermissionState? = nil, lastSuccessfulRefresh: Date? = nil, lastError: String? = nil) {
        self.permission = permission
        self.lastSuccessfulRefresh = lastSuccessfulRefresh
        self.lastError = lastError
    }
}

/// User-facing summary of a source, built from research status + implementation state +
/// device state. The wording is deliberately plain and never implies monitoring.
public struct SourceSummary: Sendable, Hashable, Identifiable {
    public var id: String
    public var channel: String
    public var title: String
    public var statusLine: String
    public var detail: String
    public var canConnect: Bool
    public var isAutomatic: Bool
    public var nextStep: String
}

public struct IntegrationCapabilityRegistry: Sendable {
    public var entries: [CapabilityEntry]
    public var implementation: [String: ImplementationState]
    public var deviceState: [String: DeviceCapabilityState]

    /// Routes implemented by this build. Keep in sync with the app's adapters.
    public static let builtInImplementation: [String: ImplementationState] = [
        "contacts-cncontactstore": .implemented,
        "platform-contacts-limited-access": .implemented,
        "calendar-eventkit-full-access": .implemented,
        "platform-share-extension": .implemented,
        "imessage-sms-user-share-capture": .manualImport,
        "whatsapp-chat-export": .manualImport,
        "linkedin-data-archive-import": .manualImport,
        "platform-messageui-composer": .implemented,
        "platform-foundation-models": .implemented,
        "platform-sfspeechrecognizer-ondevice": .implemented,
        "platform-vision-ocr": .implemented,
        "platform-local-notification-limit": .implemented,
        "platform-apple-pay-merchant-handoff": .implemented,
    ]

    public init(entries: [CapabilityEntry], implementation: [String: ImplementationState] = builtInImplementation, deviceState: [String: DeviceCapabilityState] = [:]) {
        self.entries = entries
        self.implementation = implementation
        self.deviceState = deviceState
    }

    /// Loads the bundled research catalog.
    public static func bundled() throws -> IntegrationCapabilityRegistry {
        guard let url = Bundle.module.url(forResource: "capability-matrix", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let entries = try JSONDecoder().decode([CapabilityEntry].self, from: Data(contentsOf: url))
        return IntegrationCapabilityRegistry(entries: entries)
    }

    public func entry(_ id: String) -> CapabilityEntry? { entries.first { $0.id == id } }

    public func entries(forChannel channel: String) -> [CapabilityEntry] {
        entries.filter { $0.channel == channel }
    }

    public static let requiredChannels = [
        "contacts", "calendar", "linkedin", "facebook", "instagram", "email", "imessage-sms", "whatsapp", "desktop-capture",
    ]

    /// Honest per-route summary for the Sources screen.
    public func summary(for entry: CapabilityEntry, now: Date) -> SourceSummary {
        let implemented = implementation[entry.id] ?? .notImplemented
        let device = deviceState[entry.id]
        var statusLine: String
        var canConnect = false
        var isAutomatic = false
        switch (implemented, entry.status) {
        case (.implemented, _):
            canConnect = true
            isAutomatic = entry.channel == "calendar" || entry.channel == "contacts"
            switch device?.permission {
            case .denied?, .restricted?: statusLine = "Access is off in Settings"
            case .limited?: statusLine = "Limited to contacts you chose"
            case .writeOnly?: statusLine = "Write-only access cannot read events"
            case .authorized?: statusLine = "Connected"
            default: statusLine = "Available"
            }
        case (.manualImport, _):
            canConnect = true
            statusLine = "Manual import — you choose what to share; nothing is monitored"
        case (.notImplemented, .verified), (.notImplemented, .prototype):
            statusLine = "Not built yet — feasible route under evaluation"
        case (.notImplemented, .blocked):
            statusLine = "Not available — blocked by provider terms, approval or server requirements"
        case (.notImplemented, .unavailable):
            statusLine = "Not offered by the provider"
        case (.notImplemented, .notInvestigated):
            statusLine = "Not yet investigated"
        }
        var detail = entry.dataScope
        if let refreshed = device?.lastSuccessfulRefresh {
            let hours = Int(now.timeIntervalSince(refreshed) / 3600)
            detail += hours < 1 ? " Refreshed within the last hour." : " Last refreshed \(hours) hours ago."
        }
        if let error = device?.lastError {
            statusLine = "Needs attention: \(error)"
        }
        return SourceSummary(
            id: entry.id,
            channel: entry.channel,
            title: entry.route,
            statusLine: statusLine,
            detail: detail,
            canConnect: canConnect,
            isAutomatic: isAutomatic,
            nextStep: entry.nextExperiment
        )
    }
}
