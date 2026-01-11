import Foundation

/// Validates SF Symbol SVG files for correct structure
struct SymbolValidator {

    /// Validation result
    struct ValidationResult {
        var isValid: Bool
        var errors: [ValidationError]
        var warnings: [String]

        static var success: ValidationResult {
            ValidationResult(isValid: true, errors: [], warnings: [])
        }
    }

    /// Validation error types
    enum ValidationError: LocalizedError, Equatable {
        case fileNotReadable
        case missingSymbolsLayer
        case missingGuidesLayer
        case missingTemplateVersion
        case invalidTemplateVersion(String)
        case missingRegularVariant
        case missingUltralightVariant
        case missingBlackVariant

        var errorDescription: String? {
            switch self {
            case .fileNotReadable:
                return "Could not read the SVG file"
            case .missingSymbolsLayer:
                return "Missing 'Symbols' layer (id=\"Symbols\")"
            case .missingGuidesLayer:
                return "Missing 'Guides' layer (id=\"Guides\")"
            case .missingTemplateVersion:
                return "Missing template version text element (id=\"template-version\")"
            case .invalidTemplateVersion(let value):
                return "Invalid template version: '\(value)' (expected 'Template v.X.X')"
            case .missingRegularVariant:
                return "Missing Regular-S weight variant"
            case .missingUltralightVariant:
                return "Missing Ultralight-S weight variant"
            case .missingBlackVariant:
                return "Missing Black-S weight variant"
            }
        }
    }

    /// Validate an SF Symbol SVG file
    static func validate(at url: URL) -> ValidationResult {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return ValidationResult(isValid: false, errors: [.fileNotReadable], warnings: [])
        }

        return validate(content: content)
    }

    /// Validate SVG content string
    static func validate(content: String) -> ValidationResult {
        var errors: [ValidationError] = []
        var warnings: [String] = []

        // Check for Symbols layer
        if !content.contains("id=\"Symbols\"") {
            errors.append(.missingSymbolsLayer)
        }

        // Check for Guides layer
        if !content.contains("id=\"Guides\"") {
            errors.append(.missingGuidesLayer)
        }

        // Check for template version
        if !content.contains("id=\"template-version\"") {
            errors.append(.missingTemplateVersion)
        } else {
            // Validate template version format
            if let versionMatch = content.range(of: "Template v\\.[0-9]+\\.[0-9]+", options: .regularExpression) {
                let version = String(content[versionMatch])
                if version != "Template v.6.0" && version != "Template v.5.0" && version != "Template v.4.0" {
                    warnings.append("Using template version \(version), recommended version is 6.0")
                }
            } else if content.contains("id=\"template-version\"") {
                // Has the element but bad format
                errors.append(.invalidTemplateVersion("format not recognized"))
            }
        }

        // Check for weight variants
        if !content.contains("id=\"Regular-S\"") {
            errors.append(.missingRegularVariant)
        }

        if !content.contains("id=\"Ultralight-S\"") {
            warnings.append("Missing Ultralight-S variant (optional but recommended)")
        }

        if !content.contains("id=\"Black-S\"") {
            warnings.append("Missing Black-S variant (optional but recommended)")
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    /// Import a custom symbol SVG to the Icons directory
    static func importSymbol(from sourceURL: URL, named name: String) throws -> String {
        let configManager = ConfigManager.shared
        let relativePath = "\(name).svg"
        let destinationURL = configManager.iconsDirectoryURL.appendingPathComponent(relativePath)

        // Validate first
        let result = validate(at: sourceURL)
        guard result.isValid else {
            throw ImportError.validationFailed(result.errors)
        }

        // Copy to Icons directory
        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)

        return relativePath
    }

    enum ImportError: LocalizedError {
        case validationFailed([ValidationError])

        var errorDescription: String? {
            switch self {
            case .validationFailed(let errors):
                return "Symbol validation failed: " + errors.compactMap { $0.errorDescription }.joined(separator: ", ")
            }
        }
    }
}
