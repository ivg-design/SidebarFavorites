"use client";
import { useState } from "react";
import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import { FolderTile, MacWindow, Pane, SideHeading, SideRow, Sidebar, Vivid } from "./finder/Finder";
import { Glyph } from "./glyphs";
import Shot from "./Shot";
import Zoom from "./everywhere/Zoom";
import { OwnFolderIcon, PaneFolder } from "./both/OwnIcons";
import "../app/both.css";

const STATE = {
  on: { dot: "#30D158", note: "Finder Sync helper SBF-DemoBoth registered · about 6 MB · no window · nothing at login",
    says: "The folder keeps its icon everywhere (Desktop, Finder windows, the Dock) and the row keeps your glyph." },
  off: { dot: "#3B82F7", note: "Folder icon removed · a copy is kept in ~/Library/Application Support/SidebarFavorites/IconBackups/",
    says: "The folder goes back to a plain icon, which is enough to make the glyph stick. Nothing is deleted until you press Save or Apply." },
} as const;

export default function BothIcons() {
  const [both, setBoth] = useState(true);
  const s = STATE[both ? "on" : "off"];
  return (
    <section id="both" className="sec bx">
      <div className="wrap">
        <div className="cols bx-cols">
          <div className="bx-copy">
            <Reveal>
              <h2 className="h2">Folders with an icon of their own.</h2>
              <p className="lede">{nb("Some folders carry an icon you pasted into Get Info, usually so they are recognisable in the Dock. On macOS 26 that icon fights the sidebar: Finder redraws the row from the folder’s own icon whenever the folder changes, and your glyph disappears.")}</p>
            </Reveal>
            <button type="button" role="switch" aria-checked={both} className="bx-sw" data-testid="both-switch" onClick={() => setBoth((v) => !v)}>
              <span className="bx-track" aria-hidden="true"><i /></span>
              <span className="bx-sw-l">Keep both icons</span>
            </button>
            <p className="prose bx-says" data-testid="both-says" aria-live="polite">{nb(s.says)}</p>
            <p className="fine">{nb("The cost: Both icons mode adds one small Finder Sync helper for this favorite, about 6 MB, with no window and nothing at login. Switch back and the helper is removed. Do nothing at all and the glyph goes whenever the folder changes, until you press Refresh.")}</p>
          </div>
          <div className="bx-object">
            <Vivid className="bx-panel">
              <Zoom flex={420}>
                <MacWindow title="Desktop" className="bx-win" sideWidth={170}>
                  <Sidebar>
                    <SideHeading>Favorites</SideHeading>
                    <SideRow icon={<Glyph name="desktopcomputer" />} label="Desktop" selected />
                    <SideRow icon={<Glyph name="doc.text" />} label="Documents" />
                    <div data-testid="both-row" data-glyph="star.fill">
                      <SideRow label="DemoBoth" icon={<Glyph name="star.fill" size={16} />} />
                    </div>
                  </Sidebar>
                  <Pane>
                    <FolderTile label="Notes" custom={<PaneFolder />} />
                    <div data-testid="both-tile" data-badge={both}>
                      <FolderTile label="DemoBoth" custom={
                        <span className="bx-layer" aria-hidden="true">
                          <span data-show={both}><OwnFolderIcon /></span>
                          <span data-show={!both}><PaneFolder /></span>
                        </span>
                      } />
                    </div>
                    <FolderTile label="Shots" custom={<PaneFolder />} />
                  </Pane>
                </MacWindow>
              </Zoom>
              <p className="mac-note bx-note" data-testid="both-status" role="status" aria-live="polite">
                <i aria-hidden="true" style={{ background: s.dot }} />
                <span key={String(both)} className="bx-in">{nb(s.note)}</span>
              </p>
            </Vivid>
          </div>
        </div>
        <div className="bx-shots">
          <Shot name="SBFAddFavoriteWithExistingIcon" crop={{ x: 60, w: 900, y: 410, h: 340 }} cropLabel="the choice the editor offers"
            alt="Cropped from the Add Favorite editor: a warning that this folder has a custom icon of its own, above the three choices Keep both icons, Remove its icon and Leave as is"
            caption={nb("Add a folder with its own icon and the editor says so, then offers three ways out.")} />
          <Shot name="SBFAddFavoriteAdvancedSuccess" crop={{ x: 60, w: 840, y: 420, h: 430 }} cropLabel="after Keep both icons"
            alt="Cropped from the Add Favorite editor: the warning has turned into a confirmation, Mode is set to Both icons, and a line names the helper SBF-DemoBoth, about 6 MB"
            caption={nb("Pick Keep both icons and the warning turns into confirmation. The line underneath names the helper it will add.")} />
        </div>
      </div>
    </section>
  );
}
