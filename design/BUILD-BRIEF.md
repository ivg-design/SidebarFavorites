# SidebarFavorites landing + docs — build brief (from the approved wireframe)

Wireframe: design/exports/sidebarfavorites-landing-wireframe.png, docs: design/exports/sidebarfavorites-docs-wireframe.png. The PNG is the design; this file is what it cannot show.

## Identity
- Cream paper (bg #FBF7F0, surface #FFFDF9, ink #1E1B16, muted #6E675C, line #E3DCD0, sidebar #EFEAE1, graphite #2A2722), coral accent #E8542F (soft #FBE4DC).
- Display: Fraunces (600; italic 400 for "finally legible."). Body: Public Sans. Mono: JetBrains Mono.
- Hero: Finder-window mock 640×540 bleeding off the LEFT edge (titlebar dots, sidebar with Favorites rows — the custom ones with coral glyphs — and a file grid), headline "Your sidebar," 112 px + "finally legible." italic coral; subhead; coral "Download for Mac" + brew chip with copy icon; fineprint. App icon design/assets/sidebarfavorites-icon.png (nav, footer, docs).
- Real screenshots in design/assets/*.png (converted from docs/assets/*.webp): SBFMainWindow, SFSymbolBrowser, SBFAddFavoriteWindow, svg-import, custom-svg-settings, SBFAddFavoriteWithExistingIcon, SBFTaskbarPopOver, SBFSettings.

## Sections (landing)
Nav (How it works · Custom icons · Everywhere · Both icons · Under the hood · Docs · Install · GitHub · Install) · Hero · Before/After (two VERTICAL sidebar columns 250 wide, grey folders → coral glyphs, 56 px arrow between, copy right: "Same eight folders. Now you can tell them apart at a glance." + note "Icons stay monochrome — shape is the signal") · Demo video (placeholder player: "Watch: a grey sidebar becomes legible in 30 seconds" — the SidebarFavorites recording is still to be made; wire a <video> with poster and the play overlay; do NOT use the WebWatcher video) · How it works (three numbered steps with real screenshots) · Custom icons (copy with four inline-icon bullets + monochrome note; two tall screenshots right) · Everywhere (sidebar-coloured band; four inline-icon rows: local, iCloud/CloudStorage, disks, network shares; note about Finder's synthesised rows) · Both icons (screenshot left; copy with the three radio choices) · Under the hood (graphite, 140 px padding; "No extension. No daemon. No login item." 60 px; ledger of giant numerals 96 px in coral: 17 bytes / 0 processes / 1 file / 1 request with explanations; popover screenshot + "Every favorite one click away in the menu bar") · Install (full-bleed coral; "Install once. Forget it exists." 72 px cream; graphite brew box with the three commands + trust note; "or"; dark button "Download SidebarFavorites 1.2.2 · DMG · 12 MB"; drag-to-Applications line) · Footer.
Facts: macOS 13+, universal (Apple Silicon + Intel), MIT, brew tap ivg-design/tap, releases https://github.com/ivg-design/SidebarFavorites/releases.

## Docs site (/docs)
Tree: Getting started: Quick start, Install (Homebrew / DMG), Updates · Guides: Custom SVG icons, Cloud folders, Disks and network shares, Keeping both icons, The menu bar popover · Reference: How it works, config.json, Uninstalling, Building from source, Nix flake · Help: Troubleshooting, FAQ, Report an issue. Content from README.md sections (real prose, with the screenshots), ⌘K search, prev/next.

## Motion & delight
- Hero signature: the Finder mock's grey folders morph into their glyphs one row at a time, 60 ms stagger, ease-out-quint 480 ms; headline words rise 12 px + fade with the same stagger. Reduced motion = final state.
- Before → After: the arrow draws, then the After icons swap in top-to-bottom; hovering an After row previews that icon in the hero sidebar.
- Steps: screenshots rise + fade at 30 % in view, 100 ms stagger; step numbers fill from outline to solid.
- Custom icons: a draggable 50–150 % size-slider toy updating a sidebar-row preview live (the one interactive element).
- Under the hood: the numerals count up once on enter (600 ms).
- Install: copy-to-clipboard on the brew block → icon flips to a check, "Copied" 1.2 s. Easter egg: click the nav icon five times → the hero sidebar shuffles through SF Symbol favourites.
- Global: transform/opacity only, ease-out-quart/quint, exits 75 % of entrances, prefers-reduced-motion everywhere.
