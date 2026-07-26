import Foundation
import UniformTypeIdentifiers

/// Mints and validates the private four-character OSType codes that bind a
/// favorite to its icon.
///
/// A code is written into the helper bundle's
/// `UTTypeTagSpecification["com.apple.ostype"]` and set verbatim as a sidebar
/// row's `com.apple.LSSharedFileList.OverrideIcon.OSType` property. Codes are
/// **case-sensitive** on both sides (verified: `BLT1` resolves to a declared
/// UTI while `blt1`, `BLt1` and `bLt1` each produce a distinct dynamic UTI),
/// so the alphabet is all-uppercase and nothing here ever normalizes case.
enum OSTypeAllocator {
    /// Namespace marker. Apple's own sidebar/system codes are lowercase or
    /// lower-camel words (`macs`, `root`, `trsh`, `sbHm`, `fldr`, ...), so an
    /// uppercase `S` followed by digits/uppercase letters sits outside that space.
    static let prefix: Character = "S"

    /// 32 characters, I/L/O/U omitted so codes stay unambiguous when read aloud
    /// or typed by hand while debugging.
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    /// S000 ... SZZZ
    static let capacity = 32 * 32 * 32

    /// Lowercase because LaunchServices lowercases UTI identifiers on ingest
    /// (measured: "com.ivg-design.SidebarFavorites.icon.q001" ->
    /// "...sidebarfavorites.icon.q001").
    static let ourUTIPrefix = "com.ivg-design.sidebarfavorites.icon."

    /// Codes known to be claimed by macOS. Trivially satisfied by the
    /// `S`-prefixed shape; kept as a cheap assertion against future shape changes.
    static let reservedCodes: Set<String> = [
        "macs", "root", "trsh", "sbHm", "sbNw", "sbIC", "sbNC", "sbOD", "sbTM",
        "gnet", "macn", "srvr", "disk", "fldr", "docs", "apps", "dsk ", "hdsk", "tris", "fdrp"
    ]

    /// Pure and total: any `Int` maps to a well-formed code.
    static func code(forIndex index: Int) -> String {
        String([
            prefix,
            alphabet[(index >> 10) & 31],
            alphabet[(index >> 5) & 31],
            alphabet[index & 31]
        ])
    }

    /// True when `code` is exactly four ASCII characters: the prefix plus three
    /// alphabet characters.
    static func isWellFormed(_ code: String) -> Bool {
        guard code.count == 4, code.utf8.count == 4 else { return false }
        let characters = Array(code)
        guard characters[0] == prefix else { return false }
        return characters.dropFirst().allSatisfy { alphabet.contains($0) }
    }

    /// A code may be used when it is well formed, not already handed out to
    /// another favorite, not one of the known system codes, and not declared by
    /// some other application's bundle.
    static func isAvailable(_ code: String, assigned: Set<String>) -> Bool {
        guard isWellFormed(code) else { return false }
        guard !assigned.contains(code) else { return false }
        guard !reservedCodes.contains(code) else { return false }
        return !isClaimedByOthers(code)
    }

    /// Lowest free index wins, so codes stay dense and human-debuggable
    /// (`S000`, `S001`, `S002`, ...).
    static func allocate(avoiding assigned: Set<String>) throws -> String {
        let taken = sanitize(assigned: assigned)
        for index in 0..<capacity {
            let candidate = code(forIndex: index)
            if isAvailable(candidate, assigned: taken) {
                return candidate
            }
        }
        throw AllocationError.exhausted
    }

    /// Drops malformed entries so a hand-edited or partially-migrated config
    /// self-heals instead of permanently reserving garbage.
    static func sanitize(assigned: Set<String>) -> Set<String> {
        assigned.filter { isWellFormed($0) }
    }

    /// The real guarantee against third-party and future-Apple codes.
    /// The `ourUTIPrefix` exclusion is what makes the probe idempotent: once our
    /// own helper has registered a code, re-running allocation must not treat it
    /// as foreign.
    private static func isClaimedByOthers(_ code: String) -> Bool {
        UTType(tag: code,
               tagClass: UTTagClass(rawValue: "com.apple.ostype"),
               conformingTo: nil)
            .map { $0.isDeclared && !$0.identifier.lowercased().hasPrefix(ourUTIPrefix) } ?? false
    }

    enum AllocationError: LocalizedError {
        case exhausted

        var errorDescription: String? {
            switch self {
            case .exhausted:
                return "Ran out of available icon codes. Remove an existing favorite and try again."
            }
        }
    }
}
