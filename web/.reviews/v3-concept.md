# SidebarFavorites web v3 — concept

v1 was rejected outright; v2 ("very vanilla") was a correct, quiet page: paper, a display grotesk, the
owner's screenshots on gradient panels, one faithful Finder window in a band. Nothing in it would stop a
motion designer. v3 keeps v2's foundations that were right (the spacing scale, the native-metric Finder
kit and its cross-dissolve, the screenshot pipeline, the owner's rules) and replaces everything that
read as a template: the composition, the type, the colour arc, and the absence of a single motion idea.

## The one idea: the page opens inside the sidebar

At 1440×900 the first thing on screen is not a website. It is Finder's sidebar, blown up to the height of
the viewport and flush against its left edge: the three traffic lights the size of coins, "Favorites",
and eight rows that all carry the same grey folder. The world is grey. Beside it, on the owner's own
wallpaper drained of colour, the headline:

    Your sidebar,
    finally ▢▢▢▢▢▢▢.

The last word is seven identical grey folders. You can read the first two lines at a glance; the third
you cannot, and that is the product's complaint stated as type.

Then the product happens. 0.9 s in, the first row's folder cross-dissolves into a hammer; 90 ms later the
next into a music note; and as each row resolves, the matching folder in the headline resolves into its
letter — l, e, g, i, b, l, e — set in the owner's italic serif. With the rows, colour arrives: the
wallpaper saturates from grey to the orange–magenta–violet–blue of his screenshots. By 2.1 s the
viewport is exactly the owner's house style (a dark Finder window on a vivid wallpaper), the sidebar is
legible, and so is the word.

Scrolling zooms out. The giant sidebar is pinned and shrinks under the scrollbar until it is a
normal-sized Finder window with its toolbar and pane fading in around it; the headline drifts up and
away. The thing you were inside turns out to have been one window, which is now the figure beside
"Pick a folder. Pick an icon. Add." The page then steps out onto paper and tells you how.

Why it is true to the product: SidebarFavorites has one move, grey folder → glyph you recognise, and one
claim, legibility. The hero shows the move at poster scale on the real object, lets the claim's own word
suffer the same illegibility and the same cure, and resolves into the owner's own screenshot style
rather than into a website aesthetic. Nothing in the fold is decoration: every pixel is Finder, the
wallpaper, or the sentence.

Why it is bold: a desktop UI column at 2.4× native scale, bleeding off the viewport, is an image nobody
puts on a product page; a monochrome world that gains colour row by row is a memorable arc; the headline
is kinetic in the only way the product permits (nothing flips, bounces or scrambles — things resolve).
And the scroll handoff makes the hero an object, not a banner.

## Typographic system

- Headline: **Schibsted Grotesk** 700, `clamp(56px, 7.6vw, 124px)`, tracking −0.035em, leading 0.92,
  sentence case. One word, "legible.", in **Newsreader** italic 450 at opsz 72, tracking −0.04em — the
  owner's signature pivot (mograph.life: "Made to *move.*"). The italic word is the one that is resolved
  from folders; it is the only serif on the home page. The headline is legible at a glance: the first
  two lines are static; the third resolves inside 2.1 s; reduced motion renders the end state.
- Section titles: Schibsted Grotesk 700 at `clamp(36px, 4.4vw, 64px)`, tracking −0.03em, leading 0.98.
  No eyebrows, no numbering, no accent word.
- Body: Schibsted Grotesk 400 at 17/1.55 (16 on phones), measure ≤ 62ch. Lede 20/1.45.
- Code and symbol names: **JetBrains Mono** 400/500. Symbol names are set in mono everywhere because
  that is what the app's Symbol-name field accepts.
- Inside every mock of macOS: the system font (SF), native metrics, scaled only by transform. The hero
  sidebar is the same `.mac-side` as every other mock, at `--z` 2.4 instead of 1.3.
- Type scale, spacing scale (`--s-1 … --s-11`), radii and section rhythm stay as v2 defined them; the
  tokens change names only where the colour system does.

## Colour

- Stage (the hero): Finder's dark material (`--mac-side #26262A`, `--mac-win #1E1E20`) on the owner's
  wallpaper gradient (sampled from his captures: `#2A61D8 → #F0803C → #D13A8F → #5B3FB8 → #2A61D8`,
  angled, soft). Before the move the wallpaper is the same gradient under `saturate(0) brightness(.92)`;
  the saturation is animated with the rows. The stage never uses glow, glass or neon.
- Page: warm paper `#F1F0EA`, ink `#161817`, ink-2 `#3B3E3C`, muted `#636865`, hairline `#D9D8D0`.
  A dark band (`#1A1A1C`, Finder's window black warmed) for "Under the hood".
- One accent, locked: wallpaper magenta `#D2358A` (links, focus, the selected state outside mocks), with
  `#B02A74` for small text on paper (≥ 4.5:1). Finder blue stays inside mocks.
- Vivid gradient appears exactly where the owner puts it: behind a dark window. Never as a page
  background, never as text.

## Motion language

One ease for everything that moves on its own: `cubic-bezier(.16, 1, .3, 1)` (the owner's across his
sites). One verb: **resolve** — a 420 ms cross-dissolve with 1.5 px of blur, the v2 `Morph`. Nothing
scales, bounces, flips or scrambles. Three motion pieces, each with a reason:

1. **The move (time-driven, once):** window settles 0 → 700 ms; rows resolve from 900 ms at 90 ms
   stagger; the seven headline folders resolve in step with rows 1–7; wallpaper saturation 0 → 1 from
   900 ms to 1 900 ms; `data-done` at ~2.3 s. Replay button. Reduced motion: end state at t = 0.
2. **The zoom-out (scroll-driven, scrubbed):** GSAP ScrollTrigger pins the stage for one viewport; the
   sidebar's transform interpolates from the hero fit (`--z` ≈ 2.4, flush left) to its seat inside a
   native Finder window at 1.3×; toolbar and pane fade in over the last third; the headline block rises
   and fades over the first third. Below 900 px wide or under reduced motion there is no pin: the hero
   is followed by the window at rest.
3. **Answers to the user (feedback):** every interactive element changes the product's object within
   150–420 ms: a picked icon resolves in the row; a typed name lights the matching symbol names and
   draws the glyph; a dropped SVG becomes a 16 pt silhouette; "Keep both icons" puts the badge back on
   the pane folder.

Reveals on scroll: the v2 `Reveal` (12 px, once) on section copy only — never on lists, never staggered
twice on a page. No marquee except the symbol wall's drift, which has a pause control.

## The sections and what each interactive element demonstrates

1. **Hero — the sidebar.** Click any favourite row → the app's quick-pick grid (6 × 3) in a macOS
   popover beside the row; pick → the row's glyph resolves. Replay re-runs the move. The 1.2.2 facts
   (macOS 13+, universal, free, MIT) and the DMG from the latest release sit under the headline.
2. **Pick a folder. Pick an icon. Add.** The handed-off Finder window at rest, the owner's
   `SBFMainWindow` and `SBFAddFavoriteWindow` captures at the one scale, and the Symbol-name field
   live: type a name → preview enlarged and at 16 pt in a row.
3. **8,300 symbols, by name.** A wall of real SF Symbol names (from this Mac's catalogue) in mono,
   drifting slowly, as a texture of the dark band. A search field above it is the app's Browse All…
   search: type → matching names stay lit and the rest dim; the first hit the site can draw appears in a
   sidebar row. Honest limits stated in copy: names only, the app also searches keywords.
4. **Any SVG. Nothing to prepare.** Three sample marks plus a real drop zone: drop or paste any SVG and
   it is flattened to a single silhouette with a CSS mask (the app's own operation, literally) and shown
   enlarged and at 16 pt in a row, with the app's warnings list. The `svg-import` and
   `custom-svg-settings` captures beside it.
5. **Local, cloud, disks, shares.** Rows for iCloud Drive, Google Drive (CloudStorage), a volume and a
   share: click a row → its path appears, the way the manager window shows it.
6. **Folders with an icon of their own.** The pane folder with a badge; toggle "Keep both icons" → badge
   stays and the sidebar glyph is set; the mode's cost (a small helper) stated beside it.
7. **No extension. No daemon. No login item.** Dark band: the file tree the app writes, the 17-byte
   helper bundle, the four facts. Click a node → what is inside it.
8. **Install once. Forget it exists.** Brew (three lines that fit a phone) with copy, DMG with version
   and size from the release, "Requires macOS 13+".

## Three alternatives I rejected

- **The split-flap drum.** A hero that is a mechanical drum of symbols flipping past: the most "motion"
  of the candidates and the least true — the app never flips anything; Browse All… is a search field.
  Decorative motion on a product that is about quiet correctness. The symbol wall keeps its texture
  idea without the mechanism.
- **The 8,300 wall as the hero.** A viewport of glyphs resolving under the cursor. Beautiful, but Apple's
  licence keeps SF Symbol vectors out of a web page, names alone are not legible at a glance, and it
  sells breadth before the one move. It is section 3.
- **The whole Finder window at viewport scale (v2, bigger).** Chrome at 2.4× spends the fold on a
  toolbar; the sidebar is the product's entire stage, and the window's chrome is more convincing when it
  arrives at normal size in the zoom-out.

(Also rejected: a brutalist/terminal treatment built on the 17-byte helper and `config.json` — from the
product, but it is the dark-terminal cluster every AI reaches for, and it sells plumbing before the
picture.)

## What stays from v2

Spacing scale and section rhythm; the Finder kit at native metrics; `Morph`/`RowGlyph`; `Shot` at one
scale and `images:build`; `nb()`; the header (64 px, 54 px icon) and footer (56 px); docs shell
(centred, decoded entities, tables never wrap code); the release fetch with 1.2.2 fallback; puppeteer
tests and the shot/probe scripts; the brew lines; reduced-motion end states.
