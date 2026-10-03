"use client";
import { useState } from "react";
import { asset } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import { FolderTile, MacWindow, Pane, SideHeading, SideRow, Sidebar, FolderGlyph, Vivid } from "./finder/Finder";
import { Glyph } from "./glyphs";
import { MacGlyph } from "./demos/macGlyph";
import "../app/demos.css";

type Mode = "keep" | "remove" | "leave";

const CHOICES: { id: Mode; head: string; text: string }[] = [
  { id: "keep", head: "Keep both icons", text: nb("Folder keeps its icon everywhere and the row keeps your glyph. Adds one small Finder Sync helper (≈ 6 MB, no window, nothing at login) for that favorite.") },
  { id: "remove", head: "Remove its icon", text: nb("Back to a plain folder, which is enough to make the glyph stick. A copy is kept in IconBackups.") },
  { id: "leave", head: "Leave as is", text: nb("Change nothing; the glyph disappears whenever the folder changes, until you press Refresh.") },
];

const STATUS: Record<Mode, { text: string; dot: string }> = {
  keep: { text: nb("Finder Sync helper SBF-DemoBoth registered · ≈ 6 MB · nothing at login"), dot: "#30D158" },
  remove: { text: nb("Folder icon removed · a copy is kept in IconBackups"), dot: "#3B82F7" },
  leave: { text: nb("Sidebar glyph lost whenever this folder changes · press Refresh"), dot: "#FF9F0A" },
};

export default function BothIcons() {
  const [mode, setMode] = useState<Mode>("keep");
  const customTile = mode !== "remove";
  const rowGlyph = mode === "leave" ? "folder" : "star.fill";
  const n = "SBFAddFavoriteWithExistingIcon";
  return (
    <section id="both" className="sec">
      <div className="wrap bi2-grid">
        <Reveal>
          <Vivid className="bi2-panel">
            <MacWindow title="Desktop" className="bi2-win">
              <Sidebar>
                <SideHeading>Favorites</SideHeading>
                <SideRow icon={<Glyph name="desktopcomputer" />} label="Desktop" selected />
                <SideRow icon={<Glyph name="doc.text" />} label="Documents" />
                <div data-testid="both-row" data-glyph={rowGlyph === "folder" ? "folder" : "star"}>
                  <SideRow icon={rowGlyph === "folder" ? <span className="demo-pop" key="f" style={{ display: "grid" }}><FolderGlyph /></span> : <MacGlyph name={rowGlyph} />} label="DemoBoth" />
                </div>
              </Sidebar>
              <Pane>
                <FolderTile label="Notes" />
                <div className="bi2-tilewrap" data-testid="both-tile" data-folder={customTile ? "custom" : "plain"}>
                  <span className="demo-pop" key={customTile ? "c" : "p"}>
                    <FolderTile label="DemoBoth" custom={customTile ? <Glyph name="star.fill" size={24} /> : undefined} />
                  </span>
                </div>
                <FolderTile label="Shots" />
              </Pane>
            </MacWindow>
            <p className="bi2-status" data-testid="both-status" aria-live="polite" style={{ "--dot": STATUS[mode].dot } as React.CSSProperties}>
              <i aria-hidden="true" /><span key={mode}>{STATUS[mode].text}</span>
            </p>
          </Vivid>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="bi2-copy">
            <p className="eyebrow">Keeping both icons</p>
            <h2 className="display h-sec">Folders with an icon of their own get a choice.</h2>
            <p className="lede">{nb("Pasted a custom icon into Get Info so the folder is recognisable in the Dock? On macOS 26 that icon fights the sidebar glyph. When you add such a folder the app says so and offers three ways out — none does anything until you save.")}</p>
            <div className="bi2-choices" role="radiogroup" aria-label="What to do with the folder's own icon">
              {CHOICES.map((c) => (
                <label key={c.id} className="bi2-choice">
                  <input type="radio" name="both-mode" value={c.id} checked={mode === c.id} onChange={() => setMode(c.id)} data-testid={`both-choice-${c.id}`} />
                  <i className="bi2-dot" aria-hidden="true" />
                  <span><b>{c.head}</b><span className="d">{c.text}</span></span>
                </label>
              ))}
            </div>
            <figure className="bi2-fig">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(`/shots/${n}-w504.webp`)} srcSet={`${asset(`/shots/${n}-w504.webp`)} 504w, ${asset(`/shots/${n}-w1008.webp`)} 1008w`}
                sizes="220px" width={504} height={1142} alt="Add Favorite sheet warning that the folder has a custom icon of its own, with the choices Keep both icons, Remove its icon and Leave as is" loading="lazy" decoding="async" />
              <figcaption>The dialog that offers the choice.</figcaption>
            </figure>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
