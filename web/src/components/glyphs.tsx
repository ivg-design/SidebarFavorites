"use client";
import {
  Hammer, Music, Palette, Rocket, GitBranch, Cloud, Camera, ReceiptText, Folder,
  Star, Heart, Bookmark, Flag, Tag, Archive, Briefcase, FileText, Image as ImageIcon, Video,
  Github, Gamepad2, Terminal, Wrench, Leaf, Sun, Coffee, Globe, Lock, House, Monitor, FileStack, Download, Server, CloudUpload,
  type LucideIcon,
} from "lucide-react";

/** Stand-ins for SF Symbols. Names mirror the SF Symbol they imitate. */
export const GLYPHS: Record<string, LucideIcon> = {
  "hammer.fill": Hammer, "music.note": Music, "paintpalette": Palette, "paperplane.fill": Rocket,
  "arrow.triangle.branch": GitBranch, "icloud": Cloud, "camera": Camera, "doc.text.magnifyingglass": ReceiptText,
  folder: Folder, "star.fill": Star, "heart.fill": Heart, "bookmark.fill": Bookmark, "flag.fill": Flag,
  "tag.fill": Tag, "archivebox.fill": Archive, "briefcase.fill": Briefcase, "doc.text": FileText,
  "photo": ImageIcon, "video.fill": Video, "gamecontroller": Gamepad2, "terminal": Terminal,
  "wrench.fill": Wrench, "leaf": Leaf, "sun.max": Sun, "cup.and.saucer": Coffee, "globe": Globe,
  "lock.fill": Lock, house: House, desktopcomputer: Monitor, "doc.on.doc": FileStack, "arrow.down.circle": Download, "externaldrive.connected.to.line.below": Server, "icloud.and.arrow.up": CloudUpload, "custom.github": Github,
};

export interface Fav { name: string; glyph: string }

/** The eight folders from the before/after. Hero uses the first six as custom rows. */
export const FAVS: Fav[] = [
  { name: "Forge", glyph: "hammer.fill" },
  { name: "Samples", glyph: "music.note" },
  { name: "Brand", glyph: "paintpalette" },
  { name: "Launch 2026", glyph: "paperplane.fill" },
  { name: "Repos", glyph: "arrow.triangle.branch" },
  { name: "Google Drive", glyph: "icloud" },
  { name: "Shoots", glyph: "camera" },
  { name: "Invoices", glyph: "doc.text.magnifyingglass" },
];


export function Glyph({ name, size = 16, strokeWidth = 1.75, className }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const Ic = GLYPHS[name] ?? Folder;
  return <Ic size={size} strokeWidth={strokeWidth} aria-hidden="true" className={className} />;
}
