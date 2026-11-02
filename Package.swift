// swift-tools-version: 6.0
//
// LittleThingsKit: the platform-independent core of LittleThings.ai.
//
// Everything that can be expressed without Apple UI frameworks lives here so it can be
// compiled and tested on any machine (including Linux CI) with `swift test`.
// The native iPhone app in App/ links these modules and adds SwiftUI plus the Apple
// framework adapters (Contacts, EventKit, UserNotifications, LocalAuthentication, ...).
//
// Encryption dependencies (see docs/decisions/ADR-0002-encrypted-vault.md):
//   * Apple platforms: SQLCipher Community Edition via Zetetic's official SwiftPM package
//     (BSD-style license) and Apple CryptoKit.
//   * Linux (tests/CI only): the system libsqlcipher (apt: libsqlcipher-dev) and
//     apple/swift-crypto, which exposes the CryptoKit API on non-Apple platforms.

import PackageDescription

#if os(Linux)
let externalDependencies: [Package.Dependency] = [
    .package(url: "https://github.com/apple/swift-crypto.git", "3.0.0"..<"6.0.0"),
]
let sqlCipherDependency: Target.Dependency = "CSQLCipher"
let cryptoDependencies: [Target.Dependency] = [.product(name: "Crypto", package: "swift-crypto")]
let platformTargets: [Target] = [
    .systemLibrary(name: "CSQLCipher", path: "Sources/CSQLCipher", providers: [.apt(["libsqlcipher-dev"])]),
]
#else
let externalDependencies: [Package.Dependency] = [
    .package(url: "https://github.com/sqlcipher/SQLCipher.swift.git", exact: "4.20.0"),
]
let sqlCipherDependency: Target.Dependency = .product(name: "SQLCipher", package: "SQLCipher.swift")
let cryptoDependencies: [Target.Dependency] = []
let platformTargets: [Target] = []
#endif

let package = Package(
    name: "LittleThingsKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "LTDomain", targets: ["LTDomain"]),
        .library(name: "LTVault", targets: ["LTVault"]),
        .library(name: "LTSuggestions", targets: ["LTSuggestions"]),
        .library(name: "LTIntegrations", targets: ["LTIntegrations"]),
        .library(name: "LTIntelligence", targets: ["LTIntelligence"]),
        .library(name: "LTCapture", targets: ["LTCapture"]),
        .library(name: "LTPolicy", targets: ["LTPolicy"]),
        .library(name: "LTAppCore", targets: ["LTAppCore"]),
        .library(name: "LTTestSupport", targets: ["LTTestSupport"]),
    ],
    dependencies: externalDependencies,
    targets: platformTargets + [
        // Records, value types, date semantics, recurrence. No dependencies.
        .target(name: "LTDomain"),

        // Thin re-export of CryptoKit (Apple) or swift-crypto (Linux).
        .target(name: "LTCryptoSupport", dependencies: cryptoDependencies),

        // Encrypted SQLCipher persistence, migrations, key protocol, backup/restore, deletion.
        .target(name: "LTVault", dependencies: ["LTDomain", "LTCryptoSupport", sqlCipherDependency]),

        // Deterministic suggestion rules, card state machine, relationship rhythm.
        .target(name: "LTSuggestions", dependencies: ["LTDomain"]),

        // Integration protocols, capability registry, notification planning, calendar reconciliation.
        .target(name: "LTIntegrations", dependencies: ["LTDomain", "LTSuggestions", "LTCryptoSupport"]),

        // Local intelligence contract: untrusted-output validation, pattern extraction, templates.
        .target(name: "LTIntelligence", dependencies: ["LTDomain"]),

        // Capture pipeline: share inbox (HPKE), user-authorized imports, identity resolution.
        .target(name: "LTCapture", dependencies: ["LTDomain", "LTCryptoSupport", "LTIntelligence"]),

        // Deterministic outbound action policy (FR8, FR9, FR16).
        .target(name: "LTPolicy", dependencies: ["LTDomain", "LTCryptoSupport"]),

        // Observable application model and use cases shared by the iOS app and tests.
        .target(name: "LTAppCore", dependencies: [
            "LTDomain", "LTVault", "LTSuggestions", "LTIntegrations",
            "LTIntelligence", "LTCapture", "LTPolicy", "LTCryptoSupport",
        ]),

        // Fake clock, fake providers, in-memory key store, synthetic fixtures.
        .target(name: "LTTestSupport", dependencies: ["LTDomain", "LTVault", "LTAppCore", "LTIntegrations", "LTIntelligence"]),

        .testTarget(name: "LTDomainTests", dependencies: ["LTDomain", "LTTestSupport"]),
        .testTarget(name: "LTVaultTests", dependencies: ["LTVault", "LTDomain", "LTTestSupport", "LTCryptoSupport"]),
        .testTarget(name: "LTSuggestionsTests", dependencies: ["LTSuggestions", "LTDomain", "LTTestSupport"]),
        .testTarget(name: "LTIntegrationsTests", dependencies: ["LTIntegrations", "LTSuggestions", "LTDomain", "LTTestSupport"]),
        .testTarget(name: "LTIntelligenceTests", dependencies: ["LTIntelligence", "LTDomain", "LTTestSupport"]),
        .testTarget(name: "LTCaptureTests", dependencies: ["LTCapture", "LTDomain", "LTTestSupport", "LTCryptoSupport"]),
        .testTarget(name: "LTPolicyTests", dependencies: ["LTPolicy", "LTDomain", "LTTestSupport"]),
        .testTarget(name: "LTAppCoreTests", dependencies: ["LTAppCore", "LTDomain", "LTVault", "LTTestSupport", "LTIntegrations", "LTPolicy", "LTCapture"]),
    ]
)
