# Screenshots to retake (for the owner)

Sources live in `design/assets/*.png` (2x retina, dark window on the vivid wallpaper). The site renders
every capture at 0.65x its pixels (1.3x true size), so UI text reads at ~17 px: please keep capturing
at 2x with the same wallpaper and the same window chrome.

## Stale: visible build string `1.2.0 (47)`

| file | where the string shows | also stale because |
|---|---|---|
| `SBFMainWindow.png` | footer of the manager window, bottom-left | row list is from 1.2.0; 1.2.2 made both windows resizable |
| `SBFTaskbarPopOver.png` | "SidebarFavorites 1.2.0 (47)" line above Quit | — |

## Probably stale: editor was a sheet, 1.2.2 made it its own window

| file | why |
|---|---|
| `SBFAddFavoriteWindow.png` | 1.2.2 release note: "the editor is its own window, both windows resize". Please confirm the capture shows the free-standing editor window with its own traffic lights. |
| `SBFAddFavoriteWithExistingIcon.png` | same editor; also carries the "This folder has a custom icon of its own" choice — needed whole (the site shows it full height). |
| `SBFAddFavoriteAdvancedSuccess.png` | same editor after "Keep both icons". |
| `custom-svg-settings.png` | same editor in Custom SVG mode with the Size slider and the Preview panel. |
| `svg-import.png` | the import step; please capture after choosing a file so the warnings list (what was dropped or flattened) is visible — the site quotes that list. |

## Fine as they are

`SFSymbolBrowser.png` (8 302 symbols, Browse All…), `SBFSettings.png` (helper status), `SBFUpdateNotification.png`,
`example.png` (the Finder sidebar with glyphs — this one is a cropped Finder sidebar; a full Finder window with
the same sidebar, 2x, would let the site show it whole as the "after" proof).

## Nice to have (new)

- A full dark Finder window (not just the sidebar) with 6–8 custom favorites, 2x, on the wallpaper: the site's
  hero is a rebuilt Finder window; a real one would replace it in the "How it works" step 3 and in the docs.
- `SBFMainWindow.png` resized a little wider than default, so the paths do not truncate (`~/Library/Cloud…otion Graphics`).
