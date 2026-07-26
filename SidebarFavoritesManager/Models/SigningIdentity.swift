import Foundation

/// Signing identity options for code signing
enum SigningIdentity: String, Codable, CaseIterable {
    case automatic = "automatic"
    case adHoc = "-"
    case appleDevelopment = "Apple Development"
    case developerID = "Developer ID Application"

    var displayName: String {
        switch self {
        case .automatic: return "Automatic (recommended)"
        case .adHoc: return "Ad-hoc (no certificate)"
        case .appleDevelopment: return "Apple Development"
        case .developerID: return "Developer ID Application"
        }
    }
}
