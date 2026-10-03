# SidebarFavorites web — v2 audit (before any change)

Rejected build: tag `web-v1-rejected`. Captured headless from my own `next build && next start -p 3243`
at 1440 / 1280 / 834 / 390 (`.reviews/v2/before/*.png`). Measurements below are from the DOM at 1440.

## Verdict

The owner's four words are all correct and all have a single root cause: the page was designed around a
gimmick (the site's navigation as a sticky Finder "Favorites" rail) and everything else was squeezed around
it. The hero lost 232 px, the headline was folded four times to fit, the serif italic was chosen for the fold
rather than for reading, the screenshots were shrunk into whatever slots were left, and section padding was
patched per section to make the fold work beside the rail. Fix the cause, not the symptoms: no rail.

## Findings

### 1. Layout — the rail steals the hero
- `.rail` is 232 px wide and sticky for the full 8 793 px page. The hero section is 1 193 px of a 1 440 px
  viewport; its copy column is **394 px** (`.hx-copy` x = 951, w = 394).
- Into those 394 px the h1 is set at 94.5 px, which forces the deliberate "four-word stack"
  (`Your / sidebar, / finally / legible.`), 355 px tall. A headline this size needs ≥ 700 px to sit on two lines.
- The stage is 655 px wide, the Finder window 623 × 801 px, clipped to a 600 px tall panel: the window's
  bottom third (the folder tiles, which the pane exists to show) is cut off at every width.
- Everything after the hero is also 232 px narrower than the viewport, so two-column sections
  (custom icons, both icons, everywhere) run at 480–590 px per column: too narrow for the screenshots,
  too wide for the type measure.
- The rail duplicates the header (both say Docs, GitHub, Install) and the footer (same seven links).
  Three navigations for one page.

### 2. Type — the word "legible" is the least legible thing on the page
- `.hx-h1 em` = Fraunces, italic, weight 400, opsz 96, coral `#E8542F` on cream `#FBF7F0`, 94.5 px.
  A high-contrast Venetian italic at this size has hairlines of about 1 px; the looped italic `g` and the
  `f`/`l` ascenders in coral-on-cream (3.3 : 1 before the hairline thinning) blur at a glance. The word
  that promises legibility is the one you have to re-read.
- The headline also enters word by word (`hx-rise`, 60 ms stagger), so for the first ~0.4 s it is not
  readable at all. A headline about legibility must be legible instantly.
- Section h2s are all Fraunces 600 at 56 px with `opsz 72`; Fraunces at that weight on cream gets
  blotchy in the counters (`Pick a folder. Pick an icon. Add.`). The serif was a mood choice, not a reading
  choice, and it fights the SF-set Finder mocks that sit next to it.
- Decision for v2 (justified in "Type system" below): Fraunces leaves. Display becomes a grotesk that
  shares SF's proportions, so headline and mock belong to one world; Public Sans stays as body;
  JetBrains Mono stays for code.

### 3. Padding — no scale, patched per section
Measured `padding-top / padding-bottom` of the main sections at 1440:

| section | top | bottom |
|---|---|---|
| hero | 24 | 96 |
| before/after | 40 | 96 |
| how / custom / everywhere / both | 128 | 128 |
| under the hood | 0 | 0 (inner block sets its own) |
| install | 128 | 128 |
| footer | 56 | 64 |

`--section-y` exists in globals.css but is overridden in four places, and inner spacings use
40 / 48 / 56 / 72 / 96 freely. Nothing is on a scale, so the page has no rhythm: every section is a
different distance from its neighbour for no reason. v2: one scale (4 → 160, documented in globals.css)
and three named section rhythms.

### 4. Screenshots — shrunk, cropped, mixed scales, stale
The owner's captures are 2× retina windows on a vivid gradient (design/assets, 584–1138 px wide, up to
2 284 px tall). On the page:

| capture | source px | rendered px | note |
|---|---|---|---|
| SBFMainWindow | 860 × 1124 | 334 × 417 | object-fit crop, bottom cut |
| SFSymbolBrowser | 1119 × 1197 | 334 × 417 | 30 % scale, symbol grid unreadable |
| SBFAddFavoriteWindow | 960 × 1930 | 334 × 417 | lower two-thirds cropped away |
| custom-svg-settings | 1138 × 1935 | 480 × 816 | 42 % scale, body text ~6 px |
| SBFAddFavoriteWithExistingIcon | 1008 × 2284 | 593 × 198 | sliver crop of a dialog |
| SBFTaskbarPopOver | 584 × 657 | 292 × 336 | 50 %, fine but a different scale again |

Four different scales (30 %, 42 %, 50 %, ad-hoc crop) across six images; three of six are
cropped by `object-fit` rather than on purpose. Text inside the captures is 6–8 px. The app's build
string is visible: **SBFMainWindow and SBFTaskbarPopOver show `1.2.0 (47)`**; the live release is 1.2.2.
`.reviews/screenshots-needed.md` lists every stale capture for the owner to retake.
v2: one scale system (every capture rendered at 0.65 × its retina pixels at ≥ 1280, i.e. 1.3 × true size,
so UI text reads at ~17 px; never below 560 px wide at 1440), full windows, and only labelled detail crops.

### 5. Hero animation — a pop, not a move
- Folder → glyph is `hx-folder-out` (scale 1 → .7, fade) over `hx-glyph-in` (scale .6 → 1, fade), 480 ms,
  60 ms stagger: a cartoon pop. Nothing in macOS pops; Finder cross-dissolves.
- The pane's big "preview" morphs through the Rive blob (`folder-morph.riv`: eight 96-point contours
  interpolated by Luau). Interpolating a folder outline into a palette or a paper plane passes through
  shapes that look like cookies (390 px capture, frame "Brand"). Rive is the wrong tool for
  unrelated silhouettes: morph only looks good between related shapes.
- The window's chrome mixes three icon vocabularies: lucide outline icons for system rows
  (AirDrop, Recents, Applications…), filled SF-style silhouettes for the custom rows, and CSS
  box-shadow "blue folders" with lucide badges in the pane. Finder uses one weight everywhere.
- The selection auto-advances every 2.4 s forever: a window that keeps changing on its own reads
  as a screensaver, not a demonstration.

### 6. Interactivity that proves nothing
- Hero rows select on hover and change the title bar: a hover with no product outcome.
- "Both icons" radio cards change a mock, good, but the dialog screenshot below is a 198 px sliver.
- The 17 bytes / 0 processes / 1 file / 1 request block is the "big number + small label" template
  (an AI tell per the frontend-design skill) and the numbers are not even comparable units.
- How-it-works is three static cards with three cropped screenshots; the step numbers are coral
  discs over nothing.
- The before/after panel (`BeforeAfter`) duplicates the hero's move one screen later, with a second
  copy of the same eight rows.

### 7. Phone (390) and tablet (834)
- 390: the hero stage is the 700 px window scaled to 0.6 and cropped at 300 px: UI text at ~7 px.
  How-it-works becomes a horizontal scroller with the second card cut at the edge.
- 834: no rail (good) but the vivid panel repeats five times at full width with the same gradient,
  so the page is a stack of identical purple blocks.
- No horizontal overflow at any width (one thing to keep).

### 8. Accuracy (README / release)
- Copy is accurate to README.md: SF Symbol count (~8 300), cloud folders, Locations behaviour,
  Both-icons helper (~6 MB, no window, nothing at login), 17-byte `#!/bin/sh` no-op, config.json path,
  one update request per launch. Keep the facts; rewrite the copy only where the layout changes.
- Release: latest is **v1.2.2** ("the editor is its own window, both windows resize", 2026-08-02),
  one asset `SidebarFavorites-1.2.2.dmg`; fallback in `src/lib/github.ts` matches. Universal,
  macOS 13+, `brew tap ivg-design/tap` → `brew trust` → `brew install --cask sidebarfavorites`.
- The captures predate 1.2.2 (build 1.2.0 (47)); their content (editor as a sheet vs own window) is
  partly stale too — listed in screenshots-needed.md.

### 9. Docs
- Docs layout is centred, has the sidebar/toc, header icon is 54 px in a 64 px bar (rule: header minus
  5 px → 54 px: correct) and links home. Keep the shell; retune the type and the screenshot scale to the
  same system as the landing page (quick start shows the main window at 243 px wide and the SF browser
  at 980 px: two scales on one page).

## v2 concept: "The sidebar, at full size"

One idea: the product has one move (grey folder → a glyph you recognise) and the site shows that move
once, big, perfectly, and then lets you make it yourself. Everything else on the page is a consequence
of that move.

- **Nav**: a compact 64 px top bar (brand, five section links, Docs, GitHub, Install). No rail.
- **Hero**: full width. Headline on paper, two lines, left-aligned, 96 px, legible the instant it paints
  (no per-word entrance). Sub + CTAs to its right. Below it a full-bleed vivid panel (the owner's
  wallpaper) with one faithful dark Finder window, rendered large (sidebar rows at 1.3 ×), and the move:
  the window settles, then each favourite's grey folder cross-dissolves into its glyph, top to bottom,
  80 ms apart, 420 ms each, ease-out-quint, no scale, no bounce. Then it stops. Then it is yours:
  click a row, the app's quick-pick grid opens, pick a symbol, the row changes. Reduced motion shows the
  end state and keeps the picker.
- **Sections** (rhythm: feature / beat / band): How it works (three real captures at one scale),
  Custom SVG (drop a mark → see the silhouette → size slider drives a true-scale row), Everywhere
  (local / cloud / disks / shares, with the Locations choice shown as its visible consequence),
  Both icons (the three-way choice and what each does to the tile, the row and Login Items),
  Under the hood (the mechanism as an annotated bundle listing, not four big numbers), Install.
- **Screenshots**: one scale system, full windows, labelled detail crops only, retina sources, stale
  list for the owner.

## Type system (v2)

- **Display: Bricolage Grotesque** (variable; `opsz` 12–96, `wght` 200–800, `wdth` 75–100), served by
  next/font. Used for h1/h2/h3 only, upright, weight 560–640, `opsz` 96 at display sizes, tracking
  −0.02 em, line-height 0.98. Why: a grotesk with SF's proportions (large x-height, open counters, round
  dots) so the headline and the Finder mocks read as one world, but with enough character in the `g`,
  `a`, `y` and `R` that it is not Inter. At 96 px, weight 600, ink on paper, "legible." is the heaviest,
  clearest word on the page, which is the point.
- **Body: Public Sans** 400/600, 17 px / 1.6 at ≥ 1024, 16 px below. Measure ≤ 62 ch.
- **Mono: JetBrains Mono** 400/500 for commands, paths and the bundle listing.
- **Mocks: system font** (`-apple-system`): pictures of macOS use macOS type, never site type.
- Scale (one ratio, 1.25, rounded): 13 / 14 / 16-17 / 20 / 24 / 32 / 44 / 56 / 72 / 96 (h1 fluid
  `clamp(44px, 6.6vw, 96px)`).

## Spacing scale (v2, documented in globals.css)

`--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64 ·
`--s-9` 96 · `--s-10` 128 · `--s-11` 160. Every margin, gap and padding on the site is one of these.
Section rhythm: **feature** sections `--sec-feature` (clamp 96→128) top and bottom; **beat** sections
(denser, e.g. How it works) `--sec-beat` (clamp 64→96); **band** sections (full-bleed colour: hero panel,
install) `--sec-band` (clamp 112→160). Gutter `clamp(16px, 5.5vw, 80px)`, content max 1280 px.
