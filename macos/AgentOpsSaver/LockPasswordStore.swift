import Foundation
import CommonCrypto
import Security

enum LockPasswordError: String, Error, LocalizedError {
    case length = "Use 6–128 characters."
    case current = "Current password is incorrect."
    case storage = "Password storage is unavailable."
    var errorDescription: String? { rawValue }
}

// Only a salted verifier is persisted. Passwords never enter the observer or JavaScript.
final class LockPasswordStore {
    private struct Verifier: Codable {
        let version: Int
        let iterations: UInt32
        let salt: Data
        let digest: Data
    }
    private let file: URL
    private var verifier: Verifier?
    var isConfigured: Bool { verifier != nil }

    init(file: URL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Agent Ops/app-lock.json")) throws {
        self.file = file
        guard FileManager.default.fileExists(atPath: file.path) else { return }
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
              ((attributes[.size] as? NSNumber)?.intValue ?? 4097) <= 4096,
              let data = try? Data(contentsOf: file), let value = try? JSONDecoder().decode(Verifier.self, from: data),
              value.version == 1, value.salt.count == 32, value.digest.count == 32,
              (100_000...1_000_000).contains(value.iterations) else { throw LockPasswordError.storage }
        verifier = value
    }

    func verify(_ password: String) throws -> Bool {
        guard password.count <= 128, let verifier else { return false }
        let candidate = try derive(password, salt: verifier.salt, iterations: verifier.iterations)
        return zip(candidate, verifier.digest).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }

    func setPassword(current: String, new: String) throws {
        guard (6...128).contains(new.count) else { throw LockPasswordError.length }
        if isConfigured { guard try verify(current) else { throw LockPasswordError.current } }
        var salt = Data(count: 32)
        guard salt.withUnsafeMutableBytes({ SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }) == errSecSuccess
            else { throw LockPasswordError.storage }
        let value = Verifier(version: 1, iterations: 210_000, salt: salt,
                             digest: try derive(new, salt: salt, iterations: 210_000))
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                    attributes: [.posixPermissions: 0o700])
            try JSONEncoder().encode(value).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        } catch { throw LockPasswordError.storage }
        verifier = value
    }

    private func derive(_ password: String, salt: Data, iterations: UInt32) throws -> Data {
        var result = Data(count: 32)
        let status = password.withCString { bytes in
            salt.withUnsafeBytes { saltBytes in
                result.withUnsafeMutableBytes { output in
                    CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), bytes, password.utf8.count,
                        saltBytes.bindMemory(to: UInt8.self).baseAddress!, salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), iterations,
                        output.bindMemory(to: UInt8.self).baseAddress!, 32)
                }
            }
        }
        guard status == kCCSuccess else { throw LockPasswordError.storage }
        return result
    }
}
