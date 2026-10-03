import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_LINES, RELEASES_URL } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import CopyButton from "./CopyButton";
import "@/app/flow.css";

export default function Install({ release }: { release: SiteRelease }) {
  return (
    <section id="install" className="in">
      <div className="wrap in-grid">
        <Reveal className="in-copy-col">
          <h2 className="display in-h">Install once. Forget it exists.</h2>
          <p>Developer ID signed, notarized and stapled — it opens normally, no Gatekeeper detour. Requires macOS 13 Ventura or later; Apple Silicon and Intel. Free, MIT licensed, source on GitHub.</p>
          <p className="in-small">Updates: the app asks GitHub once per launch and shows a notice with Download / Later. That is the whole mechanism.</p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="in-brew">
            <h3>Homebrew</h3>
            <pre>{BREW_LINES.map((l) => (<span key={l}><span className="in-p" aria-hidden="true">$ </span>{l}{"\n"}</span>))}</pre>
            <p className="in-trust">brew trust is asked once: Homebrew wants you to explicitly trust a third-party tap.</p>
            <div className="in-copy" data-testid="install-copy">
              <CopyButton variant="box" text={BREW_LINES.join("\n")} label="Copy" />
            </div>
          </div>
          <div className="in-or" aria-hidden="true">or</div>
          <a className="in-dmg" href={release.dmgUrl} data-testid="install-dmg">
            <Download size={18} aria-hidden="true" />
            Download SidebarFavorites {release.version} · DMG · {release.sizeLabel}
          </a>
          <p className="in-after">Drag SidebarFavorites Manager to Applications and open it. · <a href={RELEASES_URL}>All releases on GitHub ↗</a></p>
          <p className="in-facts">Universal (Apple Silicon + Intel) · macOS 13+ · Developer ID signed and notarized · MIT</p>
        </Reveal>
      </div>
    </section>
  );
}
