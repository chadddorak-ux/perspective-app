// Re-exports Apple CryptoKit on Apple platforms and apple/swift-crypto (same API) elsewhere,
// so the rest of the package uses vetted primitives without platform conditionals.
#if canImport(CryptoKit)
@_exported import CryptoKit
#else
@_exported import Crypto
#endif
