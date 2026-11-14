import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_CMD, BREW_CASK_URL, RELEASES_URL } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import CopyButton from "./CopyButton";
import { nb } from "@/lib/nowrap";
import "@/app/install.css";

export default function Install({ release }: { release: SiteRelease }) {
  return (
    <section id="install" className="sec-band in" aria-labelledby="install-h">
      <div className="wrap cols">
        <Reveal>
          <h2 className="h2" id="install-h">Install once. Forget it exists.</h2>
          <p className="lede">{nb("Developer ID signed, notarized and stapled, so it opens normally. Free, MIT licensed.")}</p>
          <a className="btn btn-primary btn-lg in-dmg" href={release.dmgUrl} data-testid="install-dmg">
            <Download size={18} aria-hidden="true" />
            <span>Download {release.version} (DMG, {release.sizeLabel})</span>
          </a>
          <p className="fine in-req">{nb("Requires macOS 13 or later. Apple silicon and Intel.")} <a className="in-link" href={RELEASES_URL}>All releases</a></p>
          <p className="fine in-uninstall">{nb("Uninstall: Settings → Remove All Sidebar Icons, then trash the app.")}</p>
        </Reveal>

        <Reveal>
          <div className="in-term" data-testid="install-term">
            <div className="in-term-bar">
              <span className="in-term-label mono">Homebrew</span>
              <span data-testid="install-copy">
                <CopyButton variant="box" text={BREW_CMD} label="Copy" ariaLabel="Copy Homebrew install command" />
              </span>
            </div>
            <pre className="in-lines mono" tabIndex={0} aria-label="Homebrew install command"><span className="in-line"><span className="in-p" aria-hidden="true">$ </span>{BREW_CMD}{"\n"}</span></pre>
          </div>
          <p className="fine in-trust">Available in <a className="in-link" href={BREW_CASK_URL}>Homebrew Cask</a>. No third-party tap needed.</p>
        </Reveal>
      </div>
    </section>
  );
}
