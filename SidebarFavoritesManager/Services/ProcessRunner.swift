import Foundation

/// Runs command-line tools to completion and captures their combined output.
///
/// Lifted out of the 0.6.0 `IconAppGenerator` so every service that shells out
/// shares one implementation - in particular the drain-before-wait ordering,
/// which stops a chatty tool from filling the pipe buffer and deadlocking
/// against `waitUntilExit()`.
enum ProcessRunner {
    struct Result {
        let status: Int32
        let output: String

        var succeeded: Bool { status == 0 }
    }

    /// Reported when the tool could not even be launched (missing binary, no
    /// execute permission). A real termination status is never negative, so this
    /// sentinel can never collide with one.
    static let launchFailureStatus: Int32 = -1

    /// Path to the Launch Services registration tool
    static let lsregisterPath = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

    /// Run a command-line tool to completion, capturing stdout and stderr together.
    @discardableResult
    static func run(_ path: String, _ arguments: [String]) -> Result {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = arguments

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
        } catch {
            return Result(status: launchFailureStatus, output: error.localizedDescription)
        }

        // Drain the pipe before waiting so a chatty tool cannot fill the buffer
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        process.waitUntilExit()

        return Result(status: process.terminationStatus, output: output)
    }

    /// Run a tool and describe the failure, if any.
    /// Returns nil on success, or a short human-readable description (exit status
    /// plus captured output) otherwise.
    static func failureDescription(_ path: String, _ arguments: [String]) -> String? {
        let result = run(path, arguments)
        guard !result.succeeded else { return nil }

        let trimmed = result.output.trimmingCharacters(in: .whitespacesAndNewlines)

        if result.status == launchFailureStatus {
            return trimmed.isEmpty ? "could not run \(path)" : trimmed
        }

        return trimmed.isEmpty
            ? "exit status \(result.status)"
            : "exit status \(result.status): \(trimmed)"
    }
}
