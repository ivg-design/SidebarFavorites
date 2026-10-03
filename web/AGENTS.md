<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Site conventions (SidebarFavorites web) — v3

- Concept (.reviews/v3-concept.md): the page opens inside Finder's sidebar at poster scale, grey; the product's
  one move (grey folder → glyph) resolves it row by row, the headline's last word resolves from seven grey
  folders into "legible." (Newsreader italic, the only serif on the page), colour arrives with it, and
  scrolling zooms the sidebar out into a normal Finder window at rest (gsap ScrollTrigger, desktop only).
  Below the hero the page is warm paper and every section lets you make the move yourself with a visible outcome.
- Design system lives in src/app/globals.css: the spacing scale `--s-1 … --s-11` (the only spacing values on
  the site), three section rhythms (`.sec`, `.sec-beat`, `.sec-band`), the type scale (`.h1/.h2/.h3` Schibsted
  Grotesk 700, body Schibsted Grotesk, `.pivot` Newsreader italic used once, JetBrains Mono for code and symbol
  names), colours (`--paper --ink --accent` magenta …), one ease `--ease` (.16,1,.3,1) and one verb (resolve =
  420 ms cross-dissolve). No eyebrows, no numbering, no accent word in titles, no cards-in-cards. Each section
  owns one css file under src/app with its own prefix; globals holds tokens and shared type only.
- Header (src/components/Header.tsx, nav.css): 64 px bar with the 54 px brand icon linking home; transparent
  with light links over `#top` (IntersectionObserver), paper with a hairline elsewhere. Footer icon 56 px.
- Finder kit (src/components/finder): a dark Finder window at native metrics (toolbar 52, rows 24 × 13 px system
  font, 16 px glyphs) scaled only by transform (`.mac-zoom`/`--z`; 1.3 max outside the hero, ≈ 2.4 in it).
  `Morph`/RowGlyph is the folder→glyph cross-dissolve. `FolderIcon` gradient ids come from `useId`.
  Glyphs: src/components/glyphs.tsx (SF Symbol names → filled SF-style paths in glyphs-sf.tsx); the SF name
  catalogue (names only, never vectors) is src/data/sf-names.json from `node scripts/sf-names.mjs`.
- Screenshots: the owner's 2x captures in design/assets render through src/components/Shot.tsx at one scale
  (0.65× source px; never resize with CSS; a detail crop is `crop={{y,h}}` + `cropLabel`). `npm run images:build`
  regenerates public/shots and src/lib/shots.ts. Stale captures: .reviews/screenshots-needed.md.
- Owner rules: proper nouns never wrap (`nb()`); `scrollbar-gutter: stable`; entities decoded; tables never wrap
  code; no speechSynthesis/`say`; transparent assets only; reduced motion shows the end state; nothing hoverable
  that does nothing; demo video slot only (none exists); facts from the latest release with the 1.2.2 fallback.
- Verification is headless only: `NEXT_DIST_DIR=.next-x npm run build && NEXT_DIST_DIR=.next-x npx next start -p 32xx`
  (ports 3243–3249 and 3263 only; 3103 is the owner's dev server, never touch it), then
  `BASE=http://localhost:32xx node --test tests/*.mjs`; captures with `node scripts/shot.mjs <url> <out.png> <width>
  [reduced] [clickSelector]`, the hero's timeline with `node scripts/shot-hero.mjs`, everything at once with
  `BASE=… node scripts/v3-captures.mjs <outdir>`; probes with `node scripts/probe.mjs`.
- Concept and brief of this version: .reviews/v3-concept.md, .reviews/v3-brief.md; v2 audit: .reviews/v2-audit.md.
