# v3 round two — audit (independent review, 2026-10-03)

Build served headless on :3273 from `.next-r2`. Suite: 91/91 green at the start. Lighthouse r2 (headless CLI,
`.reviews/v3/lighthouse-r2/`): desktop 98/100/100/100, mobile **78**/100/100/100 (LCP 5.7 s on the h1 text,
render-blocking CSS 3 files ≈ 300 ms, 102 KiB unused JS, 137 KiB image delivery, HTML **885 KB** uncompressed).
Facts checked against README.md, CHANGELOG.md and Sources/ by a worker; tool audits by a second worker.
Ranked by impact. **[fixed]** marks what round two changed; the after-state is at the end.

## A. Blocking

1. **Zoom-out ghosting, 70–95 % of the scrub** — `src/components/hero/HeroStage.tsx` timeline: the column keeps
   moving until progress 1.0 (`duration: 1`) while the resting window fades in from 0.7 and the column only fades
   0.9→1.0. Probe at 1440/1280/1100: at p=0.9 the column is at (71,247) scale 1.08 while the resting sidebar is at
   (79,268) at 0.67 opacity → two sidebars, doubled text (`cap/sec/1440-zoom80.png`, `-zoom90.png`, `-zoom95.png`).
   At p=1 the geometry lands exactly (col = rest sidebar to the pixel), so the fix is choreography, not maths.
   **[fixed]** column lands by 0.84; the window's toolbar and pane fade in *around* its seat 0.55→0.85 with the
   resting sidebar hidden; hard swap at 0.9 (column off, resting sidebar on — identical pixels); how-copy 0.78→1.
2. **Mobile performance 78** — HTML 885 KB because the symbol wall ships 20 rows × 70 names × 2 copies = 2,800
   spans, duplicated again in the RSC payload (473 KB); three render-blocking stylesheets; `icon-180.png` for a 54 px
   slot; polyfills for `Array.prototype.at/flat`. **[fixed]** wall trimmed to what the widest viewport needs,
   `experimental.inlineCss`, a 108 px 2× icon, browserslist, duplicate SVG ids.
3. **Accuracy: the SVG demo's "warnings from the app" are not the app's** — `src/components/custom/svg.ts` strings
   ("Text was dropped…", "No viewBox…", "Strokes become…", 512 KB limit) do not exist in
   `Sources/…/Services/SymbolValidator.swift:120-218`. The app's are: embedded image dropped, live text not
   converted, unsupported tags, colours/gradients flatten, much wider/taller, almost nothing survives at 16 pt,
   fills its box, thin strokes blur. **[fixed]** the demo now lists the app's own sentences verbatim; the 512 KB
   limit is labelled as this page's.
4. **Accuracy: "the app's quick-pick grid, 6 × 3"** — the app's quick picks are 24 names in an 8-column grid
   (`Views/AddEditFavoriteSheet.swift:433-437, 739-765`); the site shows 18 (hero) / 16 (How) with nine names the
   app does not offer (paintpalette, paperplane.fill, arrow.triangle.branch, globe, icloud …). **[fixed]** both
   pickers show the app's 24 in 8 × 3; the missing silhouettes were drawn.

## B. Owner's standing rules

- Legible headline: yes, but the italic word is letterspaced — `.hx-ch { padding-inline: .05em }` adds +0.1 em per
  letter over a −0.04 em face, visible at every width and loosest at 390 (the lead's own note). **[fixed]** padding
  gone; the seven folders now sit on the baseline at x-height, so the illegible line reads as a word, not an icon row.
- One spacing scale: pass (grep: every margin/gap/padding is `--s-*` or a clamp of two).
- Screenshots large, one scale: pass (`Shot` 0.65× source px everywhere; crops labelled).
- Header icon 54 px in a 64 px bar, footer 56 px, linking home: pass (`nav.css:10`, `footer.css:4`).
- Proper nouns never wrap: pass (`tests/nowrap.mjs` at 1440/834/390).
- `scrollbar-gutter: stable`: pass (`globals.css`, `tests/layout-shift.mjs`).
- Docs centred, entities decoded, tables never wrap code: pass by inspection (`cap/sec/1440-docs*.png`).
- No speechSynthesis / `say`: pass (grep). Transparent assets: pass. Demo-video slot only: pass (no video).
- Every interactive element demonstrates the app: pass (hero rows, playground, symbol search, drop zone,
  Everywhere rows + switch, Both switch, hood nodes, Copy all). Nothing hoverable that does nothing: pass.
- Reduced motion: end state everywhere (hero test, symbols test, CSS).

## C. Tool findings (web-quality worker, axe, Lighthouse)

- axe: 0 violations on `/` and `/nope`; `landmark-unique` (moderate) on `.dx-rail` on every docs page. **[fixed]**
- Duplicate ids `bx-fb`/`bx-ff` (two `PaneFolder` gradients). **[fixed]** `useId`.
- `/favicon.ico` 404 (icon declared as png). **[fixed]** favicon.ico added.
- Docs pages: four `h2` precede the `h1` in DOM order (rail headings). Not flagged by axe; left.
- Canonicals point at the forge path; local serve lacks the base path — expected, not a bug.
- No console errors, no failed requests, 37/37 internal links 200, no horizontal overflow at 390/834/1280/1440.

## D. Minor

- "about 8,300" vs "9,184 names on the Mac that built this page": both true (the catalogue grows per macOS);
  wording now says so once. **[fixed]**
- Replay is visible at t=0 (disabled, 50 %). **[fixed]** hidden until the move is done.
- Stale captures in `.reviews/v3/*`. **[fixed]** regenerated after the changes.

## After state (round two, same machine, headless)

| | before | after |
|---|---|---|
| Suite | 91/91 | **96/96** (+ resolve ×3, how 8×3 picks, SVG warnings ×2 rewritten) |
| Lighthouse mobile `/` | 78 / 100 / 100 / 100, LCP 5.7 s | **89 / 100 / 100 / 100, LCP 3.7 s**, TBT 20 ms, CLS 0 |
| Lighthouse desktop `/` | 98 / 100 / 100 / 100 | **99 / 100 / 100 / 100**, LCP 0.9 s |
| Home HTML | 885 KB (2,800 wall spans) | **≈ 470 KB** (455 spans; halves still ≥ 2,130 px) |
| Preloaded fonts | 357 KB (two variable files) | **71 KB** (Schibsted 700 static + Newsreader italic 400 static) |
| Render-blocking CSS | 3 files, ≈ 300 ms | **0** (`experimental.inlineCss`) |
| Zoom-out 70–95 % | two sidebars, doubled text | one window; column lands at 84 %, swap at 90 %, test asserts both states |
| Capture pre-load box | 143 × 187 → 559 × 731 on lazy load (a 4× shift, pre-existing) | **reserved** (`.shot` fixed width + `max-width`; figure track stretched) |
| Horizontal overflow 390/834/1280/1440 | 0 | 0 |
| axe | `landmark-unique` on docs, duplicate ids | **clean**; docs search button named; wall names 4.6:1 |

Trade-off taken for LCP: Newsreader is now one static italic cut (no `opsz` axis), so the headline word is the text
optical size rather than the 72-pt display cut. Visibly a hair heavier; still the owner's pivot (`.reviews/v3/hero/1440-t1500.png`).
Not verifiable here: real Safari / touch (headless Chrome only); the forge base path.
Captures: `.reviews/v3/hero/` (t0, t150, t1500, t2700, picker, scroll 25–100 at 1440/1280/834/390), `.reviews/v3/r2/`
(every section and state, zoom 50/80/90/95/100, header on paper, docs ×3, changelog, 404 at 1440/834/390),
`.reviews/v3/lead/` (lead's set, regenerated), `.reviews/v3/symbols/` (worker C), `.reviews/v3/how/resolve-*.png` (worker D).
