# Round 2 audit — SidebarFavorites site (2026-10-03)

Method: own `next build && next start -p 3233`; headless Chrome at 1440×900, 1280, 1180, 834, 390×844; every section and
interaction state screenshotted (hero rows, Before/After pick, size slider 50/100/150, Both-icons radios, Everywhere tabs,
rail at top / mid / bottom, Copy chips, menu, docs index + 2 pages + changelog + 404); 40/40 puppeteer tests green before
any change; overflow scan of every element at 390 and 834; claims checked against README.md, CHANGELOG.md, the Swift sources
and `lipo -info` on the installed app.

## Anti-patterns verdict: PASS
No AI tells: Fraunces/Public Sans, cream paper with one coral accent, asymmetric hero, no card grids, no glass, no gradient
text, no bounce easing. The Finder-rail concept is distinctive. The one generic element is the demo-video "coming soon" card.

## Findings, ranked by impact

| # | Sev | Location | Finding | Evidence |
|---|-----|----------|---------|----------|
| 1 | High | `src/app/hero.css` (≥1180) | Hero misses the fold at 1440×900: headline 4 lines at 100px (h1 386×387), CTA at y≈812, brew chip cut by the viewport edge, fine print off-screen. Copy column is 386px because the rail (232) + 54% stage + 104px gap leave it nothing. | hero@1440 lines=4, heroBottom=1073; `1440-00-hero-load.png` |
| 2 | High | `src/components/Everywhere.tsx` TABS[1].word, `flow.css .ev-word` | Flipper word "iCloud & CloudStorage." overflows and is clipped by the panel (inner right 927 > panel right 909). | `1440-40-everywhere-1.png` |
| 3 | High | `src/components/DemoVideo.tsx`, `page.tsx` | A play button that, when clicked, says "The recording is being made" is a pointless interactive element on a product page (owner rule: every interaction has a visible outcome). | `1440-sec-video.png` |
| 4 | High | `hero/HeroStage.tsx` SYSTEM rows; `Everywhere.tsx`, `BothIcons.tsx`, `SizeToy.tsx`, `not-found.tsx` | Finder mocks mix filled SF-style silhouettes (custom rows) with lucide 24-grid outlines (AirDrop, Recents, Applications, Desktop, Documents, Downloads, iCloud Drive, Network, Studio NAS, GitHub mark, 404 rows). Different pen weight and proportions inside one window. | `glyphs.tsx` falls back to lucide for every name without an SF path |
| 5 | Med | `src/app/docs/docs.css` phone rule; `UnderTheHood.tsx` TRACE | Inline code wraps mid-word on phones: `OverrideIcon.O/SType`, `…/SidebarFavorites/Ico/nBackups` (3 lines), `SBF-<favorite/ name>`. Breaks should fall at `/` and `.` only. | code390 probe: how-it-works ×3, uninstalling ×2, keeping-both-icons ×2; `390-sec-hood.png` |
| 6 | Med | `BeforeAfter.tsx` | After rows have no visible affordance (only `cursor: pointer`); the only hint is muted 15px text under the panel. Most visitors will never discover the picker, which is the page's best demo. | `1440-sec-beforeafter.png` |
| 7 | Med | `BothIcons.tsx` `.bi2-fig` | The real dialog screenshot (1008×2284) is shown at 220px wide: nothing in it is legible, so it is decoration. Owner rule: real screenshots at the right size. | `1440-sec-both.png` |
| 8 | Med | `CustomIcons.tsx` / `demos.css .ci2-grid` | At ≥1024 the right column is one screenshot and ~450px of empty cream below it, while the live Preview toy (which mirrors that screenshot's Preview panel) sits at the bottom of the left column, far from what it demonstrates. | `1440-sec-custom.png` |
| 9 | Med | `hero/BigGlyph.tsx` | Fallback handoff: on `onLoad` the lucide/SF fallback unmounts immediately while the canvas fades in over 300ms → a 300ms dip where the focal glyph half-disappears. Runtime cost is 822 KB gzipped (not 600 KB), deferred 600ms + idle. | measured with `curl -H 'Accept-Encoding: gzip'`; `hx-big > canvas { transition: opacity .3s }` |
| 10 | Low | `CopyButton.tsx` chip variant | "Copied" pop (top:-26px) lands on the Download button when the chip wraps under it. | `1440-50-copy.png` |
| 11 | Low | `Footer.tsx` | "More from Forge": WebWatcher, Herald, fNav+ all link to the hub root, not to their pages. | code |
| 12 | Low | `public/shots/*` | Captures show "1.2.0 (47)" in the main window and popover while the site advertises 1.2.2. CHANGELOG 1.2.2 says the screenshot set was replaced in that release, so it is the current set; only the build string is stale. Not fixable headless. | `1440-sec-how.png` |

## Verified correct (no change)
- Universal binary claim: `lipo -info` → `x86_64 arm64`. "about 8,300 SF Symbols", "17 bytes", "SBF-<name>" helper, "≈ 6 MB",
  IconBackups, `brew trust`, Restart Finder banner, Locations patched in place, synthesised rows can't take icons: all in README/sources.
- Rail: sticky through the whole page (rail-in top 76 at scrollY 5158), `install` reachable as current and visited at the bottom
  (install top −253 < 45% line), exactly one `aria-current`, hash loads mark sections above. Logic is sound.
- Rive: `.riv` 38 KB, loads, `target` drives a true vector morph (mid-frame captured), settled shape equals the SF fallback
  (same shapely source), no console errors anywhere, no failed requests.
- Layout: no element outside the viewport at 390 or 834 on /, docs, changelog (the only wide elements are the scrolling docs tables, by design).
  `scrollbar-gutter: stable` holds on every page; docs header 65px with a 54px icon; docs main centred (260 / 235 margins at 1440).
- Nowrap phrases hold at 1440/834/390; entities decoded; 404 fits a 2400px viewport.
- Accessibility: listbox + roving focus in the picker, radiogroup, tablist with arrow keys, aria-live statuses, visible focus rings, 44px targets on phones.

## Systemic
- Icon language is the one inconsistent system: site chrome = lucide (fine), Finder mocks = must be SF-style silhouettes.
- The lead's own "weakest points" list was accurate; nothing else of High severity was found.
