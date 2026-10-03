# v2 brief for workers (read fully before touching a file)

Read `.reviews/v2-audit.md` first: it says why the previous site was rejected and what v2 is.

## Concept in one line
The product has one move — a grey folder in Finder's sidebar becomes a glyph you recognise — and the site
shows that move once, big and perfectly (the hero), then lets you make it yourself in every section.

## Hard rules (owner's, non-negotiable)
- Proper nouns never wrap: run every prose string with product names through `nb()` from `@/lib/nowrap`.
- No speechSynthesis, no `say`. Transparent assets only (no opaque PNG backgrounds).
- Facts come from README.md (repo root) and the latest release (1.2.2, universal, macOS 13+, `brew tap
  ivg-design/tap` → `brew trust ivg-design/tap` → `brew install --cask sidebarfavorites`). Do not invent features.
- Reduced motion: every animation shows its end state; every demo still works.
- Nothing hoverable that does nothing: every interactive element shows a product outcome.
- No horizontal overflow at 390. Touch targets ≥ 44 px. Keyboard operable, labelled controls.
- Headless only. Never open a browser window. Never touch port 3103. Use ports 3243–3249 and kill them when done.

## Design system (src/app/globals.css — read it, it is short)
- Spacing: only `--s-1 … --s-11` (4 → 160). No other px margins/gaps/paddings. Section rhythm classes:
  `.sec` (feature), `.sec-beat` (dense follow-up), `.sec-band` (full-bleed colour). Inside a section:
  eyebrow→heading `--s-4`, heading→lede `--s-5`, lede→content `--s-7`, between stacked blocks `--s-8`.
- Type: `.h2` / `.h3` (Bricolage Grotesque, set by the class, never restyle the family), `.eyebrow`,
  `.lede`, `.prose`, `.fine`, `.mono`. Body is Public Sans. Mocks of macOS use `var(--mac-font)` only.
- Colour: `--paper --surface --ink --ink-2 --muted --line --wash --graphite --accent --accent-ink --accent-soft`.
  Accent is for eyebrows, selection, one highlight — never fills. Finder blue only inside mocks.
- Layout: `.wrap` (max 1280 + gutters), `.cols` (5/7 copy|figure grid; `.cols-rev` flips; `.cols-even`).
- Buttons: `.btn .btn-primary|.btn-ghost .btn-lg|.btn-sm`. Copy chip: `.chip` (see CopyButton.tsx).
- Motion: `--ease-quart/quint/expo`, durations `--t-fast/base/slow`. No bounce, no elastic, no scale pops.
  Reveal on scroll: `Reveal` from `@/components/motion/Reveal` (12 px rise, once).
- Each section owns ONE css file in `src/app/<section>.css` with a unique class prefix. Import it from the
  component. Never edit globals.css or another section's file.

## Finder kit (src/components/finder/Finder.tsx) — the one visual language for every mock
`Vivid` (wallpaper panel) · `MacWindow {title, sideWidth}` → children `Sidebar` (+ `SideHeading`,
`SideRow {icon,label,selected,trailing,onClick…}`) and `Pane` (+ `FolderTile {label,selected,badge,custom}`).
`FolderGlyph` = default grey folder (16 px). `Morph {glyph,on}` = the move (folder→glyph cross-dissolve).
`FolderIcon {badge}` = blue pane folder. `Glyph {name}` from `@/components/glyphs` draws SF-style filled
silhouettes by SF name (`SF_PATHS` keys in glyphs-sf.tsx; lucide fallback otherwise — prefer SF names).
Favourites data: `FAVS` in glyphs.tsx. Scale a window with `.mac-zoom` + `--z` (transform only).

## Screenshots (src/components/Shot.tsx)
`<Shot name="SBFMainWindow" alt="…" caption="…" />` renders the owner's capture at the one scale
(0.65 × retina px). Names: SBFMainWindow, SFSymbolBrowser, SBFAddFavoriteWindow, svg-import,
custom-svg-settings, SBFAddFavoriteWithExistingIcon, SBFAddFavoriteAdvancedSuccess, SBFTaskbarPopOver,
SBFSettings, SBFUpdateNotification, example. Never resize a Shot with CSS; never crop with object-fit.
A deliberate detail crop is `crop={{y, h}}` + `cropLabel` (source px) and is always labelled.
Tall captures (AddFavorite* 1930–2284 px, custom-svg-settings 1935 px) are shown whole beside sticky copy
(`position: sticky; top: 96px` on the copy column) or as a labelled detail crop — never squeezed.

## Section ids and order (page.tsx)
`#top` hero (design lead) · `#how` How it works · `#custom` Custom icons · `#everywhere` Everywhere ·
`#both` Both icons · `#hood` Under the hood · `#install` Install. Nav links use these ids.

## Verification
`npm run build && npx next start -p 32xx` (xx from your assignment), then
`node scripts/shot.mjs http://localhost:32xx/#<id> out.png 1440` and 390, and `node scripts/probe.mjs`.
`npm run lint` must be clean. Kill your server when done. Put captures under `.reviews/v2/<section>/`.
Report in your final message: what the interactive element demonstrates, test ids you exposed, and anything
you could not verify.
