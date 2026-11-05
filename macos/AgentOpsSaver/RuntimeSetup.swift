import Foundation

enum RuntimeSetup {
    static func prepare(completion: @escaping (String?) -> Void) {
        guard let resources = Bundle.main.resourceURL else { completion("App resources are missing."); return }
        DispatchQueue.global(qos: .utility).async {
            let process = Process(), errors = Pipe()
            process.executableURL = resources.appendingPathComponent("runtime/node")
            process.arguments = [resources.appendingPathComponent("setup.mjs").path]
            process.standardOutput = FileHandle.nullDevice; process.standardError = errors
            let failure: String?
            do {
                try process.run()
                let data = errors.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                failure = process.terminationStatus == 0 ? nil : String(data: data.suffix(8192), encoding: .utf8) ?? "Local service setup failed."
            } catch { failure = error.localizedDescription }
            DispatchQueue.main.async { completion(failure) }
        }
    }
}
