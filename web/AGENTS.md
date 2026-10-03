<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Site conventions (SidebarFavorites web) — v2

- Concept: the product has one move (a grey folder in Finder's sidebar becomes a glyph you recognise); the hero shows it once, big, in one faithful Finder window (src/components/hero), and every section lets you make it yourself with a visible outcome. No navigation rail; a compact 64px top bar (src/components/Header.tsx, nav.css).
- Design system lives in src/app/globals.css: the spacing scale `--s-1 … --s-11` (the only spacing values on the site), three section rhythms (`.sec` feature, `.sec-beat`, `.sec-band`), the type scale (`.h1/.h2/.h3` Bricolage Grotesque display, Public Sans body, JetBrains Mono code), colours (`--paper --ink --accent …`). Each section owns one css file under src/app with its own prefix; globals holds tokens and shared type only.
- Finder kit (src/components/finder): a dark Finder window at native metrics (toolbar 52, rows 24 × 13px system font, 16px glyphs) scaled only by transform (`.mac-zoom`/`--z`, capped at 1.3 everywhere). `Morph`/RowGlyph is the folder→glyph cross-dissolve (opacity + blur, 420ms, ease-out-quint; no scale, no bounce). Glyphs: src/components/glyphs.tsx (SF Symbol names → filled SF-style paths in glyphs-sf.tsx).
- Screenshots: the owner's 2x captures in design/assets render through src/components/Shot.tsx at one scale (0.65× source px = 1.3× true size; never resize with CSS, never object-fit crop; a detail crop is `crop={{y,h}}` + `cropLabel`). `npm run images:build` regenerates public/shots and src/lib/shots.ts. Stale captures are listed in .reviews/screenshots-needed.md.
- Owner rules: proper nouns never wrap (`nb()` from src/lib/nowrap.ts); `scrollbar-gutter: stable`; the brand icon fills the 64px bars minus 5px (54px) and links home; entities decoded; tables never wrap code tokens; no speechSynthesis/`say`; transparent assets only; reduced motion shows the end state.
- Verification is headless only: `npm run build && npx next start -p 3243` (ports 3243–3249 only; 3103 is the owner's dev server, never touch it), then `BASE=http://localhost:3243 node --test tests/*.mjs`; screenshots with `node scripts/shot.mjs <url> <out.png> <width> [reduced] [clickSelector]` (slice tall captures with `node scripts/_slice.mjs <png> <prefix> 1100 0.6`); probes with `node scripts/probe.mjs`.
- Audit and concept of this version: .reviews/v2-audit.md; worker brief: .reviews/v2-brief.md.
