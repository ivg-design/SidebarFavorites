// On macOS with Xcode Command Line Tools:
// xcrun swift scripts/test-helper-launch.swift "/path/to/SidebarFavorites Manager.app" arm64 x86_64
// An Apple silicon machine with Rosetta can check both architectures. On Intel use x86_64.
// Each child starts suspended and is reaped before its first instruction. This checks macOS
// can start the selected slice of the signed executable without registering a Finder extension.
import Darwin
import Foundation

struct ProbeFailure: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
}

func check(_ result: Int32, _ operation: String) throws {
    guard result == 0 else {
        throw ProbeFailure("\(operation): \(String(cString: strerror(result)))")
    }
}

func checkLaunch(_ executable: URL, architecture: String, cpu: cpu_type_t) throws {
    var attributes: posix_spawnattr_t?
    try check(posix_spawnattr_init(&attributes), "Initialize spawn attributes")
    defer { posix_spawnattr_destroy(&attributes) }
    try check(posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_START_SUSPENDED)), "Set suspended launch")

    var preference = cpu
    var count = 0
    try check(posix_spawnattr_setbinpref_np(&attributes, 1, &preference, &count), "Select \(architecture)")
    guard count == 1 else { throw ProbeFailure("Could not select \(architecture)") }

    var pid: pid_t = 0
    let result = executable.path.withCString { path in
        var arguments = [UnsafeMutablePointer(mutating: path), nil]
        return posix_spawn(&pid, path, nil, &attributes, &arguments, environ)
    }
    let label = "\(executable.lastPathComponent) [\(architecture)]"
    try check(result, "Launch \(label)")

    // Ask the kernel which architecture it selected. The child remains suspended.
    var actual = proc_archinfo()
    let expectedSize = Int32(MemoryLayout.size(ofValue: actual))
    let size = proc_pidinfo(pid, PROC_PIDARCHINFO, 0, &actual, expectedSize)
    let infoError = errno

    if kill(pid, SIGKILL) != 0 && errno != ESRCH { try check(errno, "Terminate \(label)") }
    var status: Int32 = 0
    var waited: pid_t
    repeat { waited = waitpid(pid, &status, 0) } while waited == -1 && errno == EINTR
    guard waited == pid else { throw ProbeFailure("Could not reap \(label)") }
    guard size == expectedSize else {
        throw ProbeFailure("Could not inspect \(label): \(String(cString: strerror(infoError)))")
    }
    guard actual.p_cputype == cpu else { throw ProbeFailure("Wrong architecture for \(label)") }
    guard status == SIGKILL else { throw ProbeFailure("\(label) exited unexpectedly (wait status \(status))") }
    print("PASS \(label) started suspended with the requested CPU architecture")
}

do {
    let args = CommandLine.arguments
    guard args.count >= 3, args.dropFirst(2).allSatisfy({ $0 == "arm64" || $0 == "x86_64" }) else {
        throw ProbeFailure("Usage: xcrun swift \(args[0]) <Manager.app> <arm64|x86_64> [second architecture]")
    }
    let templates = URL(fileURLWithPath: args[1]).appendingPathComponent("Contents/Resources/FinderSyncTemplate")
    for architecture in args.dropFirst(2) {
        let cpu = architecture == "arm64" ? CPU_TYPE_ARM64 : CPU_TYPE_X86_64
        for name in ["host-bin", "appex-bin"] {
            try checkLaunch(templates.appendingPathComponent(name), architecture: architecture, cpu: cpu)
        }
    }
} catch {
    fputs("FAIL \(error.localizedDescription)\n", stderr)
    exit(EXIT_FAILURE)
}
