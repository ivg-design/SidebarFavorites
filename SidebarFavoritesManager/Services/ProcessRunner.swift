import Foundation

/// Runs command-line tools to completion and captures their combined output.
///
/// Lifted out of the 0.6.0 `IconAppGenerator` so every service that shells out
/// shares one implementation - in particular the drain-before-wait ordering,
/// which stops a chatty tool from filling the pipe buffer and deadlocking
/// against `waitUntilExit()`.
///
/// Every run carries a deadline. Nothing this app shells out to is interactive,
/// so a tool that has not finished within its deadline is not going to: the two
/// ways it happens in practice are `codesign` blocking on a SecurityAgent prompt
/// raised behind a locked keychain, and a tool leaving a grandchild holding the
/// inherited pipe fd. Both used to wedge the whole sync pipeline - it is strictly
/// serial, so one blocked child also blocked every later reconcile, the
/// "Restart Finder" button and the "Remove All Sidebar Icons" escape hatch - with
/// no way out short of quitting the app.
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

    /// Reported when the tool overran its deadline and had to be stopped.
    /// Distinct from `launchFailureStatus` so a caller can tell "never started"
    /// from "started and would not finish".
    static let timeoutStatus: Int32 = -2

    /// Deadline for a tool with no special needs. Generous: `lsregister -f -R`
    /// legitimately takes seconds on a busy machine, and a deadline that fires on
    /// a tool that was merely slow would be worse than the hang it prevents.
    static let standardTimeout: TimeInterval = 120

    /// `actool` compiles an asset catalog out of process and pays for a cold
    /// Xcode the first time it runs, so it gets a longer deadline than anything
    /// else.
    static let assetCompileTimeout: TimeInterval = 300

    /// Anything that can reach the keychain gets a short deadline: the failure
    /// mode there is a SecurityAgent prompt this app can neither see nor dismiss,
    /// and the sooner that degrades to "unsigned, with a warning" the better.
    static let keychainTimeout: TimeInterval = 20

    /// Path to the Launch Services registration tool
    static let lsregisterPath = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

    /// The deadline a tool gets when the call site does not name one.
    ///
    /// Keyed off the executable rather than pushed onto every call site, so a
    /// caller that has no opinion still gets the right one - `actool` is invoked
    /// from the synthesizer, which has no business knowing about signing timeouts.
    static func defaultTimeout(forTool path: String) -> TimeInterval {
        switch (path as NSString).lastPathComponent {
        case "xcrun", "actool":
            return assetCompileTimeout
        case "codesign", "security":
            return keychainTimeout
        default:
            return standardTimeout
        }
    }

    /// Run a command-line tool to completion, capturing stdout and stderr together.
    ///
    /// Returns `timeoutStatus` if `timeout` elapses before the tool exits; the
    /// tool is sent `SIGTERM` and then, if it is still there, `SIGKILL`.
    @discardableResult
    static func run(
        _ path: String,
        _ arguments: [String],
        timeout: TimeInterval? = nil
    ) -> Result {
        let deadline = timeout ?? defaultTimeout(forTool: path)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = arguments

        // Never hand a child this app's stdin. A tool that decides to read it -
        // `codesign` prompting, or anything invoked with unexpected arguments -
        // must see EOF immediately rather than block on a terminal nobody is
        // attached to.
        process.standardInput = FileHandle.nullDevice

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        let exited = DispatchSemaphore(value: 0)
        process.terminationHandler = { _ in exited.signal() }

        do {
            try process.run()
        } catch {
            return Result(status: launchFailureStatus, output: error.localizedDescription)
        }

        // Drain off the calling thread. Reading continuously is still what stops a
        // chatty tool from filling the pipe buffer, but a read to end-of-file waits
        // for EVERY writer of the pipe, not just the direct child - a grandchild
        // that inherited the fd holds it open long after the child is reaped - so
        // the deadline has to cover the read as well as the wait.
        //
        // Chunk by chunk rather than in one call, so that abandoning a drain that
        // outlives its child still yields everything the tool actually said.
        //
        // A dedicated thread rather than a global queue: a drain that is stuck
        // behind a grandchild must not consume a libdispatch worker.
        let box = OutputBox()
        let readEnd = pipe.fileHandleForReading
        Thread.detachNewThread {
            while true {
                let chunk = readEnd.availableData
                if chunk.isEmpty { break }        // empty means end of file
                box.append(chunk)
            }
            // The reader owns the handle: closing it from the waiting thread while
            // this read is in flight would free an fd number another thread could
            // already have reused.
            try? readEnd.close()
            box.finish()
        }

        if exited.wait(timeout: .now() + deadline) == .timedOut {
            process.terminate()
            if exited.wait(timeout: .now() + 2) == .timedOut,
               process.processIdentifier > 0 {
                kill(process.processIdentifier, SIGKILL)
                _ = exited.wait(timeout: .now() + 2)
            }
            // Whatever the tool managed to say before it was stopped is usually the
            // interesting part, so give the drain a moment - but never wait on it.
            box.wait(.now() + 1)
            let tool = (path as NSString).lastPathComponent
            let said = box.text.trimmingCharacters(in: .whitespacesAndNewlines)
            let notice = "\(tool) did not finish within \(Int(deadline))s and was stopped."
            return Result(status: timeoutStatus, output: said.isEmpty ? notice : "\(notice)\n\(said)")
        }

        // The child is gone. Give the drain a short grace period so nothing is lost
        // to the race between the last write and the exit, then give up on it rather
        // than inheriting some grandchild's lifetime.
        box.wait(.now() + 5)
        return Result(status: process.terminationStatus, output: box.text)
    }

    /// Run a tool and describe the failure, if any.
    /// Returns nil on success, or a short human-readable description (exit status
    /// plus captured output) otherwise.
    static func failureDescription(
        _ path: String,
        _ arguments: [String],
        timeout: TimeInterval? = nil
    ) -> String? {
        let result = run(path, arguments, timeout: timeout)
        guard !result.succeeded else { return nil }

        let trimmed = result.output.trimmingCharacters(in: .whitespacesAndNewlines)

        // Neither sentinel is an exit status, so neither is worth printing as one:
        // "exit status -2" tells the user nothing, the captured text does.
        if result.status == launchFailureStatus {
            return trimmed.isEmpty ? "could not run \(path)" : trimmed
        }
        if result.status == timeoutStatus {
            return trimmed.isEmpty ? "\(path) timed out" : trimmed
        }

        return trimmed.isEmpty
            ? "exit status \(result.status)"
            : "exit status \(result.status): \(trimmed)"
    }

    /// Collects a subprocess's output from the drain thread for the waiting thread
    /// to read, whether or not the drain ever finishes.
    private final class OutputBox: @unchecked Sendable {
        private let lock = NSLock()
        private var data = Data()
        private let done = DispatchSemaphore(value: 0)

        func append(_ chunk: Data) {
            lock.lock()
            data.append(chunk)
            lock.unlock()
        }

        func finish() {
            done.signal()
        }

        /// Waits for the drain to finish, up to `limit`. Returning early is not an
        /// error - it just means `text` is whatever had been stored by then.
        func wait(_ limit: DispatchTime) {
            _ = done.wait(timeout: limit)
        }

        var text: String {
            lock.lock()
            defer { lock.unlock() }
            return String(data: data, encoding: .utf8) ?? ""
        }
    }
}
