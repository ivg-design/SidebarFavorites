"use client";
import { useState } from "react";
import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import { FolderIcon, FolderTile, MacWindow, Pane, SideHeading, SideRow, Sidebar, Vivid } from "./finder/Finder";
import { Glyph } from "./glyphs";
import Shot from "./Shot";
import { OwnFolderIcon, OwnFolderRow } from "./both/OwnIcons";
import "../app/both.css";

type Mode = "keep" | "remove" | "leave";

const CHOICES: { id: Mode; head: string; text: string }[] = [
  { id: "keep", head: "Keep both icons", text: nb("The folder keeps its icon and the row keeps your glyph, with one small helper for this favorite.") },
  { id: "remove", head: "Remove its icon", text: nb("Back to a plain folder, which makes the glyph stick. A copy is kept.") },
  { id: "leave", head: "Leave as is", text: nb("Change nothing, and the glyph goes whenever the folder changes.") },
];

const STATUS: Record<Mode, { text: string; dot: string }> = {
  keep: { text: nb("Finder Sync helper SBF-DemoBoth registered · ≈ 6 MB · no window · nothing at login"), dot: "#30D158" },
  remove: { text: nb("Folder icon removed · copy kept in ~/Library/Application Support/SidebarFavorites/IconBackups/"), dot: "#3B82F7" },
  leave: { text: nb("Sidebar glyph lost: it disappears whenever the folder changes, until you press Refresh"), dot: "#FF9F0A" },
};

export default function BothIcons() {
  const [mode, setMode] = useState<Mode>("keep");
  const ownTile = mode !== "remove";
  const ownRow = mode === "leave";
  return (
    <section id="both" className="sec">
      <div className="wrap">
        <Reveal className="bx-head sec-head">
          <p className="eyebrow">Keeping both icons</p>
          <h2 className="h2">{nb("Folders with an icon of their own get a choice.")}</h2>
          <p className="lede">{nb("Pasted a custom icon into Get Info so the folder is recognisable in the Dock? On macOS 26 that icon fights the sidebar glyph. When you add such a folder the app says so and offers three ways out; none does anything until you save.")}</p>
        </Reveal>
        <div className="cols bx-cols">
          <Reveal>
            <Vivid className="bx-panel">
              <MacWindow title="Desktop" className="bx-win">
                <Sidebar>
                  <SideHeading>Favorites</SideHeading>
                  <SideRow icon={<Glyph name="desktopcomputer" />} label="Desktop" selected />
                  <SideRow icon={<Glyph name="doc.text" />} label="Documents" />
                  <div data-testid="both-row" data-glyph={ownRow ? "folder" : "star"}>
                    <SideRow className="bx-row" label="DemoBoth" icon={
                      <span className="bx-layer" aria-hidden="true">
                        <span data-show={!ownRow} style={{ display: "grid", placeItems: "center" }}><Glyph name="star.fill" size={16} /></span>
                        <span data-show={ownRow} style={{ display: "grid", placeItems: "center" }}><OwnFolderRow /></span>
                      </span>
                    } />
                  </div>
                </Sidebar>
                <Pane>
                  <FolderTile label="Notes" />
                  <div data-testid="both-tile" data-folder={ownTile ? "custom" : "plain"}>
                    <FolderTile label="DemoBoth" custom={
                      <span className="bx-layer" aria-hidden="true">
                        <span data-show={ownTile} style={{ display: "grid" }}><OwnFolderIcon /></span>
                        <span data-show={!ownTile} style={{ display: "grid" }}><FolderIcon /></span>
                      </span>
                    } />
                  </div>
                  <FolderTile label="Shots" />
                </Pane>
              </MacWindow>
              <p className="mac-note bx-note" data-testid="both-status" aria-live="polite" role="status">
                <i aria-hidden="true" style={{ background: STATUS[mode].dot }} />
                <span key={mode} className="bx-in">{STATUS[mode].text}</span>
              </p>
            </Vivid>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="bx-controls">
              <div className="bx-group" role="radiogroup" aria-label="What to do with the folder's own icon">
                {CHOICES.map((c) => (
                  <label key={c.id} className="bx-opt">
                    <input type="radio" name="both-mode" value={c.id} checked={mode === c.id} onChange={() => setMode(c.id)} data-testid={`both-choice-${c.id}`} />
                    <i className="bx-dot" aria-hidden="true" />
                    <span><b>{c.head}</b><span className="d">{c.text}</span></span>
                  </label>
                ))}
              </div>
              <p className="fine">{nb("A choice you can change: none of the three does anything until you save, and Cancel leaves the folder untouched.")}</p>
            </div>
          </Reveal>
        </div>
        <div className="cols cols-even bx-shots">
          <Shot name="SBFAddFavoriteWithExistingIcon" crop={{ y: 396, h: 368 }} cropLabel="the choice the editor offers"
            alt="Cropped from the Add Favorite editor: a warning that this folder has a custom icon of its own, above the three choices Keep both icons, Remove its icon and Leave as is"
            caption={nb("The same three options, as the editor shows them.")} />
          <Shot name="SBFSettings" alt="SidebarFavorites Settings showing whether each Both icons helper is enabled"
            caption={nb("Settings shows whether each Both icons helper is enabled; it appears in System Settings › General › Login Items & Extensions as SBF-<favorite name>.")} />
        </div>
      </div>
    </section>
  );
}
