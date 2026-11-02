import AVFoundation
import Foundation
import LTIntelligence
import Speech
import UIKit
import Vision
#if canImport(FoundationModels)
import FoundationModels
#endif

// MARK: - Apple Foundation Models (on-device only)

#if canImport(FoundationModels)
/// Uses `SystemLanguageModel.default`, the on-device model, after runtime availability checks.
/// Never use Apple's Private Cloud Compute model or any remote model: there is no cloud
/// fallback (PRD section 7). CI greps for that symbol.
///
/// Output is decoded into `RawExtraction` and then validated by `ExtractionValidator`; the
/// model has no tools and no authority.
/// UNVERIFIED: not compiled here. Needs an Apple Intelligence-eligible device to test.
@available(iOS 26.0, *)
struct FoundationModelsExtractor: LocalExtractionModel {
    /// The on-device model's context is small (4,096 tokens per Apple docs); keep input bounded.
    static let maximumCharacters = 6_000

    func availability() -> LocalModelAvailability {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
            return model.supportsLocale(Locale.current) ? .available : .unavailable(.unsupportedLanguage)
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible: return .unavailable(.deviceNotEligible)
            case .appleIntelligenceNotEnabled: return .unavailable(.appleIntelligenceNotEnabled)
            case .modelNotReady: return .unavailable(.modelNotReady)
            @unknown default: return .unavailable(.other)
            }
        }
    }

    func extract(_ request: ExtractionRequest) async throws -> RawExtraction {
        var bounded = request
        if bounded.sourceText.count > Self.maximumCharacters {
            bounded.sourceText = String(bounded.sourceText.suffix(Self.maximumCharacters))
        }
        let session = LanguageModelSession(model: SystemLanguageModel.default, instructions: ExtractionPrompt.instructions)
        let response = try await session.respond(to: ExtractionPrompt.prompt(for: bounded), generating: GeneratedExtraction.self)
        return response.content.raw
    }
}

@available(iOS 26.0, *)
@Generable
struct GeneratedExtraction {
    @Guide(description: "Facts explicitly stated in the note about a person")
    var facts: [GeneratedFact]
    @Guide(description: "Dates explicitly written in the note")
    var dates: [GeneratedDate]
    @Guide(description: "Commitments someone explicitly made in the note")
    var promises: [GeneratedPromise]
    @Guide(description: "Explicit current life updates about a person: new job, move, graduation, family milestone, performance, interest")
    var lifeEvents: [GeneratedLifeEvent]

    var raw: RawExtraction {
        RawExtraction(
            facts: facts.map { RawFact(personName: $0.personName.nilIfEmpty, category: $0.category, label: $0.label, value: $0.value, excerpt: $0.excerpt) },
            dates: dates.map { RawDate(personName: $0.personName.nilIfEmpty, label: $0.label, kind: $0.kind, dateText: $0.dateText, excerpt: $0.excerpt) },
            promises: promises.map { RawPromise(personName: $0.personName.nilIfEmpty, description: $0.action, owner: $0.owner, kind: $0.kind, dueText: $0.dueText.nilIfEmpty, excerpt: $0.excerpt) },
            lifeEvents: lifeEvents.map { RawLifeEvent(personName: $0.personName.nilIfEmpty, category: $0.category, summary: $0.summary, dateText: $0.dateText.nilIfEmpty, excerpt: $0.excerpt) }
        )
    }
}

@available(iOS 26.0, *)
@Generable
struct GeneratedFact {
    @Guide(description: "The person's name as written in the note, or empty")
    var personName: String
    @Guide(description: "One of: relationship, family, work, location, interest, preference, giftPreference, health, other")
    var category: String
    var label: String
    var value: String
    @Guide(description: "The exact words from the note that state this")
    var excerpt: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedDate {
    var personName: String
    var label: String
    @Guide(description: "One of: birthday, anniversary, milestone, custom")
    var kind: String
    @Guide(description: "The date words exactly as written in the note")
    var dateText: String
    var excerpt: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedPromise {
    var personName: String
    @Guide(description: "What was promised, in a few words")
    var action: String
    @Guide(description: "me if the note's author committed, them if the other person did")
    var owner: String
    @Guide(description: "commitment or followUp")
    var kind: String
    @Guide(description: "Due date words exactly as written, or empty")
    var dueText: String
    var excerpt: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedLifeEvent {
    var personName: String
    @Guide(description: "One of: newJob, move, graduation, familyMilestone, performance, interest, other")
    var category: String
    var summary: String
    @Guide(description: "Date words exactly as written, or empty")
    var dateText: String
    var excerpt: String
}
#endif

extension String {
    var nilIfEmpty: String? { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self }
}

// MARK: - On-device speech (only offered when on-device recognition is guaranteed)

enum OnDeviceTranscriber {
    enum TranscriptionError: Error { case onDeviceUnavailable, notAuthorized, noResult }

    /// The microphone path is shown only when this returns true (PRD section 7).
    static func isAvailable(locale: Locale = .current) -> Bool {
        guard let recognizer = SFSpeechRecognizer(locale: locale) else { return false }
        return recognizer.supportsOnDeviceRecognition
    }

    static func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
        }
    }

    /// Transcribes on device, then deletes the audio file.
    static func transcribe(fileURL: URL, locale: Locale = .current) async throws -> String {
        defer { try? FileManager.default.removeItem(at: fileURL) }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.supportsOnDeviceRecognition else {
            throw TranscriptionError.onDeviceUnavailable
        }
        let request = SFSpeechURLRecognitionRequest(url: fileURL)
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = false
        let once = ResumeOnce()
        return try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error {
                    if once.claim() { continuation.resume(throwing: error) }
                } else if let result, result.isFinal {
                    if once.claim() { continuation.resume(returning: result.bestTranscription.formattedString) }
                }
            }
        }
    }
}

final class ResumeOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    func claim() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if done { return false }
        done = true
        return true
    }
}

/// Records to a temporary file in the app container. The file is deleted after transcription.
@MainActor
final class VoiceRecorder: ObservableObject {
    @Published private(set) var isRecording = false
    private var recorder: AVAudioRecorder?
    private(set) var fileURL: URL?

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .spokenAudio)
        try session.setActive(true)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("memo-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1]
        recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder?.record()
        fileURL = url
        isRecording = true
    }

    func stop() -> URL? {
        recorder?.stop()
        recorder = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false)
        return fileURL
    }

    func discard() {
        _ = stop()
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
        fileURL = nil
    }
}

// MARK: - Text recognition from a picked image

enum TextRecognizer {
    /// Uses Vision text recognition. UNVERIFIED: confirm in airplane mode that recognition
    /// runs fully on device (capability matrix row `platform-vision-ocr`).
    static func recognizeText(in imageData: Data) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            guard let image = UIImage(data: imageData)?.cgImage else { return "" }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            try VNImageRequestHandler(cgImage: image).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        }.value
    }
}
