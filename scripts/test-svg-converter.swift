import AppKit
import Foundation

@main
struct CustomSVGConverterCheck {
    static func main() throws {
        guard (3...4).contains(CommandLine.arguments.count) else {
            print("usage: test-svg-converter <template.svg> <output.svg> [source.svg]")
            exit(2)
        }

        let source = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <g transform="translate(2 1)" fill="#f00">
            <path d="M3 3h16v16H3z"/>
          </g>
        </svg>
        """
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("sidebar-favorites-plain.svg")
        let sourceURL: URL
        if CommandLine.arguments.count == 4 {
            sourceURL = URL(fileURLWithPath: CommandLine.arguments[3])
        } else {
            try source.write(to: tempURL, atomically: true, encoding: .utf8)
            sourceURL = tempURL
        }
        defer { if sourceURL == tempURL { try? FileManager.default.removeItem(at: tempURL) } }

        let output = try CustomSVGConverter.convert(
            sourceURL: sourceURL,
            templateURL: URL(fileURLWithPath: CommandLine.arguments[1]),
            symbolName: "plain.logo"
        )
        precondition(output.contains("<g id=\"Regular-S\">"))
        precondition(output.contains("<g id=\"Ultralight-S\">"))
        precondition(output.contains("<g id=\"Black-S\">"))
        precondition(!output.lowercased().contains("<script"))

        let start = output.range(of: "<g id=\"Regular-S\">")!
        let end = output.range(of: "</g>", range: start.upperBound..<output.endIndex)!
        let extractedGroup = String(output[start.lowerBound...end.upperBound]) // Matches the app's current preview extraction.
        let preview = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="1389.79 620.541 120.11 80.459">
          \(extractedGroup)
        </svg>
        """
        precondition(NSImage(data: preview.data(using: .utf8)!) != nil)

        let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try output.write(to: outputURL, atomically: true, encoding: .utf8)
        print("PASS: \(outputURL.path)")
    }
}
