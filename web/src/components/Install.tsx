import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_LINES, RELEASES_URL } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import CopyButton from "./CopyButton";
import { nb } from "@/lib/nowrap";
import "@/app/install.css";

export default function Install({ release }: { release: SiteRelease }) {
  return (
    <section id="install" className="sec-band in" aria-labelledby="install-h">
      <div className="wrap cols cols-even">
        <Reveal>
          <p className="eyebrow">Install</p>
          <h2 className="h2" id="install-h">Install once. Forget it exists.</h2>
          <div className="prose in-prose">
            <p>{nb("Developer ID signed, notarized and stapled: it opens normally, with no Gatekeeper detour.")}</p>
            <p>{nb("Requires macOS 13 Ventura or later. Universal, so it runs on Apple Silicon and Intel. Free, MIT licensed, with the source on GitHub.")}</p>
          </div>
          <p className="fine in-uninstall">{nb("To uninstall, delete your favorites in the app first (Settings → Remove All Sidebar Icons does it in one step), then trash the app.")}</p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="in-term" data-testid="install-term">
            <div className="in-term-bar">
              <span className="in-term-label mono">Homebrew</span>
              <span data-testid="install-copy">
                <CopyButton variant="box" text={BREW_LINES.join("\n")} label="Copy all" ariaLabel="Copy all three Homebrew commands" />
              </span>
            </div>
            <pre className="in-lines mono">{BREW_LINES.map((l) => (<span key={l} className="in-line"><span className="in-p" aria-hidden="true">$ </span>{l}{"\n"}</span>))}</pre>
          </div>
          <p className="fine in-trust">{nb("Homebrew wants explicit trust of a third-party tap, so brew trust is asked once.")}</p>

          <div className="in-or" aria-hidden="true"><span>or</span></div>

          <a className="btn btn-primary btn-lg in-dmg" href={release.dmgUrl} data-testid="install-dmg">
            <Download size={18} aria-hidden="true" />
            <span>Download SidebarFavorites {release.version} · DMG · {release.sizeLabel}</span>
          </a>
          <p className="fine in-after">{nb("Drag SidebarFavorites Manager to Applications and open it.")} <a className="in-link" href={RELEASES_URL}>All releases on GitHub ↗</a></p>
        </Reveal>
      </div>
    </section>
  );
}
