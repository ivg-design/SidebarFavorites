// Dev tool: the SF Symbol names this Mac can draw, from CoreGlyphs (names only — never the vectors).
// usage: node scripts/sf-names.mjs  → src/data/sf-names.json  (sorted, deduplicated)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const plist = "/System/Library/CoreServices/CoreGlyphs.bundle/Contents/Resources/name_availability.plist";
const json = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist], { maxBuffer: 64 << 20 }).toString());
const names = [...new Set(Object.keys(json.symbols))].sort();
writeFileSync("src/data/sf-names.json", JSON.stringify(names));
console.log(names.length, "names");
