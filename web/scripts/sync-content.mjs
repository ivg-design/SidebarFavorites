// Copies the repo CHANGELOG.md next to the site so the build is self-contained.
import fs from "node:fs";
import path from "node:path";
const from = path.resolve(process.cwd(), "../CHANGELOG.md");
const to = path.resolve(process.cwd(), "content/CHANGELOG.md");
if (fs.existsSync(from)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); console.log("Synced CHANGELOG.md"); }
