# v3 brief for workers (read fully, then read .reviews/v3-concept.md)

v3's idea: the page opens inside Finder's sidebar at poster scale, grey; the product's move (grey folder →
glyph) resolves it, colour arrives with it, and scrolling zooms out to a normal Finder window. Below the
hero the page is warm paper and every section lets you make the move yourself with a visible outcome.
Your section must look designed by the same hand as the hero: same scale of type, same single ease, same
verb (things *resolve*: a 420 ms cross-dissolve; nothing scales, bounces, flips or scrambles).

## Hard rules (owner's, non-negotiable)
- Proper nouns never wrap: every prose string with product names goes through `nb()` from `@/lib/nowrap`.
- No speechSynthesis, no `say`. Transparent assets only. No demo video (the slot exists; never a video).
- Facts come from README.md (repo root) and the release (1.2.2, universal, macOS 13+, `brew tap
  ivg-design/tap` → `brew trust ivg-design/tap` → `brew install --cask sidebarfavorites`). Do not invent.
- Reduced motion: every animation shows its end state; every demo still works.
- Nothing hoverable that does nothing: every interactive element shows a product outcome. Hover only on
  things that can be clicked.
- No horizontal overflow at 390. Touch targets ≥ 44 px. Keyboard operable, labelled controls.
- Headless only. Never open a browser window. Never touch port 3103. Use the port in your assignment and
  kill the server when done.
- Screenshots (owner's captures) render ONLY through `Shot` at the one scale. Never resize with CSS.

## Design system (src/app/globals.css — read it, it is short)
- Spacing: only `--s-1 … --s-11`. Section rhythm: `.sec` (feature) `.sec-beat` (dense follow-up) `.sec-band`
  (full-bleed colour). heading → lede `--s-5`; lede → content `--s-7` (desktop) / `--s-6`; blocks `--s-8`.
- Type: `.h2` (Schibsted Grotesk 700, fluid 36 → 72) for section titles, `.h3`, `.lede`, `.prose`, `.fine`,
  `.mono`. Body is Schibsted Grotesk. `.pivot` (Newsreader italic) is used ONCE, in the hero — never
  elsewhere. Mocks of macOS use `var(--mac-font)` only.
- NO eyebrows (`.eyebrow` is dead; delete every use), no 01/02/03 numbering, no accent-coloured word in a
  title, no "A · B · C" meta strings, no arrows on links, no icons above headings, no cards-in-cards.
- Colour: `--paper --surface --ink --ink-2 --muted --line --line-strong --wash --graphite --accent
  --accent-ink --accent-soft`. One accent (magenta) for links, focus, selected state outside mocks — never
  a fill, never text on the vivid gradient. Finder blue only inside mocks. The vivid gradient (`.vivid`)
  appears only behind a dark window, never as a page background.
- Motion: `var(--ease)` for everything; durations `--t-fast/base/slow`. Reveal on scroll only via
  `Reveal` from `@/components/motion/Reveal`, on section copy, never on lists, never staggered.
- Layout: `.wrap` (max 1280 + gutters), `.cols` (5/7 copy|figure; `.cols-rev` flips; `.cols-even`).
  Prefer asymmetry: copy column narrow, figure wide, figures may bleed past the wrap on the right.
- Buttons: `.btn .btn-primary|.btn-ghost .btn-lg|.btn-sm`. Copy chip: `CopyButton`.
- Each section owns ONE css file in `src/app/<section>.css` with its own class prefix. Never edit
  globals.css, finder.css, glyphs*.tsx or another section's files. Ask the lead (in your report) if you
  need a shared change.

## Finder kit (src/components/finder/Finder.tsx) — the one visual language for every mock
`Vivid` · `MacWindow {title, sideWidth}` → `Sidebar` (+ `SideHeading`, `SideRow {icon,label,selected,…}`)
and `Pane` (+ `FolderTile`). `FolderGlyph` = grey folder (16 px). `Morph {glyph,on}` = the move.
`Glyph {name}` from `@/components/glyphs` draws SF-style silhouettes by SF name (`SF_PATHS` in
glyphs-sf.tsx; lucide fallback). `FAVS` in glyphs.tsx. Scale a window with `.mac-zoom` + `--z`
(transform only, 1.3 max outside the hero).

## Screenshots (src/components/Shot.tsx)
`<Shot name="SBFMainWindow" alt="…" caption="…" />`. Names: SBFMainWindow, SFSymbolBrowser,
SBFAddFavoriteWindow, svg-import, custom-svg-settings, SBFAddFavoriteWithExistingIcon,
SBFAddFavoriteAdvancedSuccess, SBFTaskbarPopOver, SBFSettings, SBFUpdateNotification, example.
Tall captures are shown whole beside sticky copy or as a labelled `crop={{y,h}}` + `cropLabel`.

## Section ids and order (page.tsx)
`#top` hero (lead's worker) · `#how` lives at the END of the hero's scroll (the window at rest + "Pick a
folder. Pick an icon. Add.") · `#how-steps` How it works (captures + Symbol-name field) · `#symbols`
8,300 symbols · `#custom` Any SVG · `#everywhere` · `#both` · `#hood` · `#install`.

## Verification (every worker, before reporting)
`npm run build && npx next start -p <your port>`; `node scripts/shot.mjs http://localhost:<port>/#<id>
.reviews/v3/<section>/1440.png 1440` and 390 (and 834 if your layout changes there); `node scripts/probe.mjs`
for overflow; a puppeteer test in `tests/<section>.mjs` for each interaction (pattern: tests/hero.mjs);
`npm run lint` clean. Kill the server. Report: what the interactive element demonstrates, test ids, what
you could not verify, and any shared change you need from the lead.
