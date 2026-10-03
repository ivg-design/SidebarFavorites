import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "building-from-source",
  title: "Building from source",
  group: "Reference",
  description: "Build SidebarFavorites with Xcode 15+ and XcodeGen, and produce a signed, notarized DMG.",
  keywords: ["build", "xcode", "xcodegen", "xcodebuild", "dmg", "sign", "notarize", "notarytool", "developer id", "build-release", "swift"],
  excerpt: "Requires Xcode 15+ and XcodeGen. Run xcodegen generate, then xcodebuild the SidebarFavoritesManager scheme.",
  sections: [
    { id: "build", title: "Build" },
    { id: "dmg", title: "A distributable DMG" },
    { id: "notarization", title: "Signing and notarization" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="build">Build</H2>
      <p>Requires Xcode 15+ and <a href="https://github.com/yonaskolb/XcodeGen" target="_blank" rel="noopener noreferrer">XcodeGen</a>.</p>
      <CodeBlock prompt label="Build commands" code={`git clone https://github.com/ivg-design/SidebarFavorites.git
cd SidebarFavorites
brew install xcodegen        # if needed
xcodegen generate
xcodebuild -scheme SidebarFavoritesManager -configuration Release`} />
      <H2 id="dmg">A distributable DMG</H2>
      <CodeBlock prompt code="./scripts/build-release.sh" label="Release script" />
      <p>The script finds a <strong>Developer ID Application</strong> identity in your keychain and signs with it (hardened runtime, timestamped), falling back to ad-hoc signing with a warning if there is none. Override it with <code>SIGN_IDENTITY=&quot;Developer ID Application: Your Name (TEAMID)&quot;</code>.</p>
      <H2 id="notarization">Signing and notarization</H2>
      <p>Notarization runs automatically when a Developer ID identity <em>and</em> a notarization keychain profile are both available. Set <code>NOTARIZE=0</code> to skip it. The profile defaults to <code>SidebarFavoritesNotary</code> (override with <code>NOTARY_PROFILE</code>) and is created once per machine. Run this yourself in Terminal; it stores an app-specific password in your keychain:</p>
      <CodeBlock prompt label="Store notarization credentials" code={`xcrun notarytool store-credentials SidebarFavoritesNotary \\
    --apple-id "you@example.com" \\
    --team-id "TEAMID" \\
    --password "app-specific-password"`} />
    </>
  );
}
