<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Site conventions (SidebarFavorites web)

- Concept: the site's own navigation is a Finder "Favorites" sidebar (src/components/rail); every mock uses the Finder kit (src/components/finder) — a dark Finder window on a vivid gradient, as in the owner's screenshots. Coral is the site accent, never a Finder tint.
- Each section owns its CSS file under src/app (hero.css, rail.css, demos.css, flow.css, docs/docs.css); globals.css holds tokens and shared type only.
- Glyphs: src/components/glyphs.tsx (SF Symbol names; filled SF-style paths in glyphs-sf.tsx, lucide fallback). Prose with product names goes through nb() from src/lib/nowrap.ts (owner rule: proper nouns never wrap).
- Rive: web/rive/folder-morph (RML + Luau, see web/rive/README.md); the signed .riv and wasm live in public/rive. Never run bare `rive <dir>` (opens a window).
- Verification is headless only: `npm run build && npx next start -p 3203`, then `BASE=http://localhost:3203 node --test tests/*.mjs`; screenshots with `node scripts/shot.mjs <url> <out.png> <width> [reduced]`; probes with `node scripts/probe.mjs`. Port 3103 belongs to the owner's dev server: never touch it.
