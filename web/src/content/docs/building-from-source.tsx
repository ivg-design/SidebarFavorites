import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "building-from-source",
  title: "Building from source",
  group: "Reference",
  description: "How to build SidebarFavorites with Xcode and XcodeGen, and how to make a signed, notarized DMG. Read it if you want to run your own build or contribute. To use the app, install it instead.",
  keywords: ["build", "xcode", "xcodegen", "xcodebuild", "dmg", "sign", "notarize", "notarytool", "developer id", "build-release", "swift"],
  excerpt: "Requires Xcode 15 or later and XcodeGen. Run xcodegen generate, then xcodebuild the SidebarFavoritesManager scheme. scripts/build-release.sh makes the DMG.",
  sections: [
    { id: "requirements", title: "Requirements" },
    { id: "build", title: "Build the app" },
    { id: "dmg", title: "Make a distributable DMG" },
    { id: "notarization", title: "Set up notarization" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="requirements">Requirements</H2>
      <p>You need these tools to build the app. Signing and notarization are only needed for a DMG you want to give to other people. To use the app without building it, see <DocLink to="install">Install</DocLink>.</p>
      <Table label="Build requirements">
        <thead><tr><th>Requirement</th><th>Version</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>macOS</td><td>13 or later</td><td>The app&rsquo;s minimum system is macOS 13, and the project targets it.</td></tr>
          <tr><td>Xcode</td><td>15 or later</td><td>It provides the compiler and <code>xcodebuild</code>.</td></tr>
          <tr><td><a href="https://github.com/yonaskolb/XcodeGen" target="_blank" rel="noopener noreferrer">XcodeGen</a></td><td>No minimum stated</td><td>It generates the Xcode project from <code>project.yml</code>.</td></tr>
          <tr><td>Developer ID Application certificate</td><td>Optional</td><td>Signs the DMG so that Gatekeeper accepts it. Without it the DMG is signed ad hoc.</td></tr>
          <tr><td>Notarization profile</td><td>Optional</td><td>Lets the script submit the app and the DMG to Apple for notarization.</td></tr>
        </tbody>
      </Table>

      <H2 id="build">Build the app</H2>
      <p>These commands build the Release configuration. Run them in Terminal, one at a time.</p>
      <Steps>
        <Step title="Clone the repository.">
          <CodeBlock prompt lang="bash" label="Clone the repository" code="git clone https://github.com/ivg-design/SidebarFavorites.git" />
        </Step>
        <Step title="Open the project folder.">
          <CodeBlock prompt lang="bash" label="Open the project folder" code="cd SidebarFavorites" />
        </Step>
        <Step title="Install XcodeGen with Homebrew, if you do not have it.">
          <CodeBlock prompt lang="bash" label="Install XcodeGen" code="brew install xcodegen" />
        </Step>
        <Step title="Generate the Xcode project." see="XcodeGen creates SidebarFavorites.xcodeproj in the project folder.">
          <CodeBlock prompt lang="bash" label="Generate the Xcode project" code="xcodegen generate" />
        </Step>
        <Step title="Build the SidebarFavoritesManager scheme." see="xcodebuild prints BUILD SUCCEEDED when the app is built. The product is named SidebarFavorites Manager.app.">
          <CodeBlock prompt lang="bash" label="Build the Release configuration" code="xcodebuild -scheme SidebarFavoritesManager -configuration Release" />
          <p>Every build raises the build number in <code>SidebarFavoritesManager/Info.plist</code> by one, so that file shows as changed in Git afterwards.</p>
        </Step>
      </Steps>

      <H2 id="dmg">Make a distributable DMG</H2>
      <p>The release script builds the app, signs it, optionally notarizes it, and packs it into a disk image with an <strong>Applications</strong> shortcut. It runs <code>xcodegen</code> itself, so you do not need to generate the project first.</p>
      <Steps>
        <Step title="Run the release script from the project folder.">
          <CodeBlock prompt lang="bash" label="Run the release script" code="./scripts/build-release.sh" />
        </Step>
        <Step title="Wait while the script works through its stages.">
          <p>It deletes the <code>build</code> folder, generates the project, builds the Release configuration, signs the helper programs and the app, notarizes and staples the app if notarization is available, builds the DMG and signs it, notarizes and staples the DMG, then verifies the signatures and prints the Gatekeeper result for each.</p>
        </Step>
        <Step title="Find the DMG." see="The script ends with Build Complete and prints the DMG path and size. The file is build/DMG/SidebarFavorites-<version>.dmg inside the project folder, where the version comes from Info.plist.">
          <p>The line after the path says whether the DMG was notarized and stapled or <q>NOT notarized</q>.</p>
        </Step>
      </Steps>
      <p>The script reads these environment variables. Put them before the command, for example <code>NOTARIZE=0 ./scripts/build-release.sh</code>.</p>
      <Table label="Environment variables read by the release script">
        <thead><tr><th>Variable</th><th>What it does</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>SIGN_IDENTITY</code></td><td>Names the certificate to sign with, for example <code>Developer ID Application: Your Name (TEAMID)</code>.</td><td>The first Developer ID Application identity in your keychain, or ad-hoc signing if there is none.</td></tr>
          <tr><td><code>NOTARIZE</code></td><td>Set to <code>0</code> to skip notarization even when everything for it is available.</td><td>Unset. The script notarizes when it has a Developer ID identity and a notarization profile.</td></tr>
          <tr><td><code>NOTARY_PROFILE</code></td><td>Names the keychain profile that holds your notarization credentials.</td><td><code>SidebarFavoritesNotary</code></td></tr>
          <tr><td><code>NOTARY_PROFILE_EXPLICIT</code></td><td>When set to anything, the script uses only the profile named in <code>NOTARY_PROFILE</code> and does not look for a fallback profile called <code>eXLib-notary</code>.</td><td>Unset.</td></tr>
        </tbody>
      </Table>

      <H2 id="notarization">Set up notarization</H2>
      <p>Notarization is Apple&rsquo;s scan of a signed app. A notarized DMG opens without the Gatekeeper warning. The script notarizes only when it has a Developer ID Application identity and a stored profile. You create the profile once for each Mac, and the script finds it by name.</p>
      <Steps>
        <Step title="Create an app-specific password for your Apple ID.">
          <p>Create it on the Apple ID account website, under <strong>Sign-In and Security</strong>. Notarization cannot use your normal Apple ID password.</p>
        </Step>
        <Step title="Store the credentials in your keychain." see="notarytool saves the credentials under the profile name SidebarFavoritesNotary.">
          <CodeBlock prompt lang="bash" label="Store notarization credentials" code={`xcrun notarytool store-credentials SidebarFavoritesNotary \\
    --apple-id "you@example.com" \\
    --team-id "TEAMID" \\
    --password "app-specific-password"`} />
          <p>Replace <code>you@example.com</code>, <code>TEAMID</code> and <code>app-specific-password</code> with your own values. The password stays in your keychain and is never written to a file.</p>
        </Step>
        <Step title="Run the release script again." see="The script prints Found notarization profile and notarizes the app and the DMG, which can take a few minutes each.">
          <CodeBlock prompt lang="bash" label="Run the release script" code="./scripts/build-release.sh" />
        </Step>
      </Steps>
      <Callout kind="tip">To use a different profile name, store the credentials under that name and set <code>NOTARY_PROFILE</code> when you run the script.</Callout>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Build problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>The script stops at <q>Generating Xcode project...</q> with <q>xcodegen: command not found</q>.</td><td>XcodeGen is not installed.</td><td>Run <code>brew install xcodegen</code>, then run the script again.</td></tr>
          <tr><td><q>WARNING: No &lsquo;Developer ID Application&rsquo; signing identity found in the keychain.</q></td><td>The keychain holds no Developer ID Application certificate.</td><td>Install the certificate, or set <code>SIGN_IDENTITY</code>. Without one, the script signs ad hoc, skips notarization, and Gatekeeper blocks the DMG until a user approves it in System Settings.</td></tr>
          <tr><td><q>NOTE: No notarization keychain profile named &lsquo;SidebarFavoritesNotary&rsquo; was found.</q></td><td>The profile does not exist on this Mac, or <code>NOTARY_PROFILE</code> names a different one.</td><td>Follow Set up notarization. Until then the script continues and makes a DMG that is not notarized.</td></tr>
          <tr><td><q>Notarization explicitly disabled (NOTARIZE=0).</q></td><td><code>NOTARIZE=0</code> is set in your environment.</td><td>Unset it to notarize.</td></tr>
          <tr><td><q>ERROR: App notarization failed.</q> or <q>ERROR: DMG notarization failed.</q></td><td>Apple rejected the submission.</td><td>Run the <code>xcrun notarytool log</code> command that the script prints, and read the reasons.</td></tr>
          <tr><td><q>ERROR: Build failed - app not found</q></td><td>The Release build did not produce the app.</td><td>Read the <code>xcodebuild</code> output above the message, and fix the first error.</td></tr>
          <tr><td><q>ERROR: could not remove build</q></td><td>A previous build left files that your account cannot delete.</td><td>Remove the <code>build</code> folder yourself, as the message says, then run the script again.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
