import Foundation
import LocalAuthentication
import LTDomain
import LTIntegrations
import LTVault
import UserNotifications

/// Complete file protection and exclusion from device backups for the vault directory.
/// The database is encrypted by SQLCipher regardless; this is defense in depth.
/// UNVERIFIED on device: confirm backup exclusion and behaviour while locked.
struct IOSFileProtection: VaultFileProtecting {
    func protectDirectory(_ url: URL) throws {
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = url
        try mutable.setResourceValues(values)
    }

    func protectFile(_ url: URL) throws {
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = url
        try mutable.setResourceValues(values)
    }
}

/// Whether the device can protect real data (a passcode is set) and which biometry exists.
struct LocalAuthenticationProtection: DeviceProtectionChecking {
    func currentProtection() -> DeviceProtection {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            if let laError = error as? LAError, laError.code == .passcodeNotSet { return .passcodeNotSet }
            return .unavailable(error?.localizedDescription ?? "Device authentication is unavailable.")
        }
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return .available(.faceID)
        case .touchID: return .available(.touchID)
        case .opticID: return .available(.opticID)
        default: return .available(.none)
        }
    }
}

/// Local notifications only; no remote push. Content is decided by `NotificationPlanner`
/// (generic by default). Identifiers are opaque digests.
struct UserNotificationScheduler: NotificationScheduling {
    func authorization() async -> NotificationAuthorization {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .ephemeral: return .authorized
        case .provisional: return .provisional
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        @unknown default: return .denied
        }
    }

    func requestAuthorization() async -> NotificationAuthorization {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        return await authorization()
    }

    func pendingIdentifiers() async -> [String] {
        await UNUserNotificationCenter.current().pendingNotificationRequests().map(\.identifier)
    }

    func schedule(_ notifications: [PlannedNotification]) async throws {
        let center = UNUserNotificationCenter.current()
        for planned in notifications {
            let content = UNMutableNotificationContent()
            content.title = planned.title
            content.body = planned.body
            content.sound = .default
            let trigger: UNCalendarNotificationTrigger
            switch planned.trigger {
            case .floating(let day, let time):
                // No time zone: fires at this wall-clock time wherever the user is.
                var components = DateComponents()
                components.year = day.year
                components.month = day.month
                components.day = day.day
                components.hour = time.hour
                components.minute = time.minute
                trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            case .absolute(let date):
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = TimeZone(identifier: "UTC")!
                var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
                components.timeZone = calendar.timeZone
                trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            }
            try await center.add(UNNotificationRequest(identifier: planned.identifier, content: content, trigger: trigger))
        }
    }

    func removePending(identifiers: [String]) async {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers)
    }

    func removeAll() async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
    }
}
