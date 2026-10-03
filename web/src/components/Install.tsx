import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_LINES, RELEASES_URL } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import CopyButton from "./CopyButton";

export default function Install({ release }: { release: SiteRelease }) {
  return (
    <section id="install" className="install">
      <div className="wrap install-grid">
        <Reveal className="copy">
          <h2 className="display h-sec">Install once. Forget it exists.</h2>
          <p>Developer ID signed, notarized and stapled — it opens normally, no Gatekeeper detour. Requires macOS 13 Ventura or later; Apple Silicon and Intel. Free, MIT licensed, source on GitHub.</p>
          <p className="small">Updates: the app asks GitHub once per launch and shows a notice with Download / Later. That is the whole mechanism.</p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="brewbox">
            <h3>Homebrew</h3>
            <pre>{BREW_LINES.map((l) => (<span key={l} style={{ display: "block" }}><span className="p" aria-hidden="true">$ </span>{l}</span>))}</pre>
            <p className="trust">brew trust is asked once: Homebrew wants you to explicitly trust a third-party tap.</p>
            <CopyButton variant="box" text={BREW_LINES.join("\n")} label="Copy" />
          </div>
          <div className="or" aria-hidden="true">or</div>
          <a className="btn btn-dark" href={release.dmgUrl}>
            <Download size={18} aria-hidden="true" />
            Download SidebarFavorites {release.version} · DMG · {release.sizeLabel}
          </a>
          <p className="after">Drag SidebarFavorites Manager to Applications and open it. · <a href={RELEASES_URL}>All releases on GitHub ↗</a></p>
        </Reveal>
      </div>
    </section>
  );
}
