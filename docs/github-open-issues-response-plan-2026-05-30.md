# GitHub Open Issues Response Plan

Generated: 2026-05-30
Repository: https://github.com/ivg-design/SidebarFavorites

## Scope

- Checked open GitHub issues and issue comments for `ivg-design/SidebarFavorites`.
- Checked open pull requests: none.
- Open issues found: 5 (`#4`, `#6`, `#7`, `#8`, `#10`).
- No issue labels or assignees are currently set.
- This report proposes replies only. No GitHub comments were posted.

## Local Context That Affects The Replies

- `README.md` already documents the `~/Library/CloudStorage/` FinderSync limitation and symlink workaround, but it should also name iCloud Drive's `~/Library/Mobile Documents/com~apple~CloudDocs` path explicitly.
- `IconAppGenerator` expands `~` before writing monitored paths, so the iCloud/Dropbox issue is unlikely to be caused by literal tildes in generated plist/resource paths.
- `IconAppTemplate/FinderSync/FinderSync.swift` only registers `directoryURLs`; it does not implement drag/drop behavior. Finder controls sidebar drop handling.
- Custom SVG import has a likely app-side bug: `extractSymbolName` expects `descriptive-name` to contain a nested `tspan`, while the bundled `custom-icon-template.svg` currently uses direct text. The bundled template also uses `Generated from rectangle.fill` as the placeholder descriptive name, which is not a clean custom symbol identifier.
- Generated app filenames and bundle identifiers are based on `Favorite.sanitizedName` only. Duplicate or near-duplicate favorite names can collide and may explain some intermittent icon replacement/cache behavior.

## #10 - Recipe / showcase: an auto-updating "Recently Used" sidebar entry with a custom SF Symbol

URL: https://github.com/ivg-design/SidebarFavorites/issues/10

Status summary:
- Reporter shared a companion repo for a "Recently Used" sidebar folder whose contents rotate via launchd and Python.
- They specifically recommend a README note about Full Disk Access/TCC for background processes.
- Current owner comment already invites a docs PR.

Outstanding comments:
- `ivg-design`: asked them to open a docs PR.

Proposed reply:

```text
Thanks again for sharing this. This is exactly the kind of recipe that fits the project: SidebarFavorites handles the real sidebar icon, while your helper handles the rotating folder contents.

A docs PR would be welcome. I would suggest adding it under a new "Recipes / Showcase" section and keeping the SidebarFavorites README focused on the icon/Finder Sync side, with a link to your repo for the launchd/Python implementation.

The TCC note is worth including. The important wording is that a background process launched by launchd does not inherit Terminal's Full Disk Access; the actual executable that mutates protected locations, such as `/usr/bin/python3` or a packaged helper binary, needs its own permission.
```

Recommended action:
- Leave open until a docs PR lands, or add a short README recipe/TCC note directly and then close.
- Add labels: `documentation`, `showcase`.

## #8 - Icons do not apply for iCloud Drive folders

URL: https://github.com/ivg-design/SidebarFavorites/issues/8

Status summary:
- Reporter says a local folder works, but an iCloud Drive folder does not.
- A commenter confirms Dropbox under `~/Library/CloudStorage/Dropbox/` also fails.
- Another commenter asks whether tilde expansion in `IconAppGenerator.swift` is related.

Outstanding comments:
- `danielemaddaluno`: confirms the same problem for Dropbox/CloudStorage paths.
- `lukelbd`: points at the path-writing lines in `IconAppGenerator.swift` and asks whether `~` in iCloud paths could be the cause.

Proposed reply:

```text
Thanks for the extra confirmations. I do not think this is caused by the tilde expansion lines: SidebarFavorites expands `~` before writing the generated extension path data.

This looks like the FinderSync/FileProvider limitation documented in the README. Cloud provider locations, including Dropbox/Google Drive paths under `~/Library/CloudStorage/`, and iCloud Drive's `~/Library/Mobile Documents/com~apple~CloudDocs`, are not normal folders from FinderSync's point of view. Finder does not reliably let a third-party Finder Sync extension provide sidebar icons for those provider-backed locations.

The current workaround is to create a normal local symlink and add the symlink path as the SidebarFavorites entry. That can restore the custom icon, but it may not preserve every Finder behavior such as drag/drop; that related limitation is being tracked in #7.

I will update the README to call out iCloud Drive's `Mobile Documents` path explicitly and add an in-app warning for cloud/provider-backed paths. After that I would close this as a documented macOS limitation unless someone finds a FinderSync-supported route.
```

Recommended action:
- Update docs to explicitly include iCloud Drive `Mobile Documents`.
- Add an in-app warning when the selected path is under `~/Library/CloudStorage/` or `~/Library/Mobile Documents/`.
- Then close as documented OS limitation, or keep as enhancement for warning UX.
- Add labels: `macos-limitation`, `documentation`, `enhancement`.

## #7 - Drag&Drop for Sidebar Favorites

URL: https://github.com/ivg-design/SidebarFavorites/issues/7

Status summary:
- Initial report: dragging files into generated sidebar favorites does not work.
- Owner asked what kind of folder was affected.
- Reporter confirmed local folders do work; failing entries were links to SMB network shares.
- Another commenter reports the same limitation for symlinks used to work around native folders such as `~/Movies`, removable/network drives, and similar targets.

Outstanding comments:
- `stormblade83`: confirms drag/drop works for local folders but not links to SMB network shares.
- `ilikepeaches`: asks whether symlink/native-folder/file-provider behavior can be improved.

Proposed reply:

```text
Thanks, the follow-up narrows this down. Local folders accepting drag/drop is the expected path. The failures reported here are all linked, network, provider-backed, or system-special folders.

SidebarFavorites uses a Finder Sync extension to register monitored directory URLs and provide sidebar icons. It does not own Finder's sidebar drop handling, and Finder appears to treat symlink, SMB, cloud/provider, and some native special-folder entries differently from ordinary local folders.

So the honest current answer is: custom icons can often be made to work for workaround paths, but drag/drop is not guaranteed for those workaround paths. I should document that tradeoff next to the symlink workaround. I will also look at adding a warning when a selected path is a symlink, network volume, or known provider path.

The `~/Movies` native icon case is probably a separate system-folder icon override limitation, not the same as local folder drag/drop. If we want to pursue that further, it should probably be tracked as a separate enhancement.
```

Recommended action:
- Document that symlink/cloud/network workarounds may lose Finder sidebar drag/drop behavior.
- Add detection/warnings for symlink, network volume, and cloud/provider paths.
- Consider splitting "override native system folder icons" into its own enhancement.
- Add labels: `macos-limitation`, `documentation`, `enhancement`.

## #6 - Error when importing a template created by SidebarFavorites

URL: https://github.com/ivg-design/SidebarFavorites/issues/6

Status summary:
- Reporter shows an import/build error and says it also happens with SF Symbols-exported templates.
- Owner asked them to share the icon.
- Local inspection shows a likely bug even without the user's exact SVG.

Outstanding comments:
- `ivg-design`: asked for the SVG/icon that caused the failure.

Proposed reply:

```text
Thanks for reporting this. I still need the failing SVG to verify the exact error, but I found a likely SidebarFavorites-side bug while reviewing the current import path.

The generator currently extracts the custom symbol name only when the SVG's `descriptive-name` element contains a nested `tspan`. The blank template bundled by SidebarFavorites uses direct text in `descriptive-name`, so a template can pass the initial structural validation and then fail later when the icon app is generated. The placeholder descriptive name is also not a clean symbol identifier.

I am going to fix the parser so it accepts both direct text and `tspan` forms, improve the error shown when `actool` or symbol-name extraction fails, and update the exported blank template to use an obvious safe placeholder custom symbol name. If you can still attach the SVG that failed, it would help me confirm the fix against your exact file.
```

Recommended action:
- Keep open as a real bug.
- Patch symbol-name extraction to support direct text and `tspan`.
- Update exported template placeholder to a valid symbol identifier.
- Surface `actool`/validation details in the UI instead of a generic error.
- Add labels: `bug`, `custom-icons`, `needs-testcase`.

## #4 - Icons changing occasionally

URL: https://github.com/ivg-design/SidebarFavorites/issues/4

Status summary:
- Reporter says some folders work only occasionally; screenshots show the icon state changing after refresh.
- They also request that closing the app with the red close button hide it from the Dock.
- There are no comments yet.

Outstanding comments:
- None.

Proposed reply:

```text
Thanks for the report. There are two separate things here.

For the icons changing after refresh: Finder does cache sidebar icons aggressively, but I also found a plausible SidebarFavorites-side cause. Generated app filenames and bundle identifiers are currently based on the favorite display name. If two favorites have the same name, or names that sanitize to the same identifier, one generated icon app can overwrite or conflict with another. That would look like icons swapping or changing after refresh.

Can you check whether any of the affected favorites have duplicate or very similar names? Either way, I will treat this as a bug and change the generated app identity to include a stable unique id, or at minimum prevent duplicate sanitized names.

For the red close button behavior: that is a separate app UX enhancement. The current SwiftUI app behaves like a normal Dock app. I can add "hide to menu bar on close" behavior when the menu bar item is enabled.
```

Recommended action:
- Keep open as bug plus UX enhancement, or split the Dock behavior into a separate issue.
- Fix generated app identity to include a stable UUID or enforce unique sanitized names.
- Add cleanup/migration for previously generated colliding apps.
- Add "hide to menu bar on close" as a separate enhancement if desired.
- Add labels: `bug`, `finder-cache`, `enhancement`.

## Suggested Triage Order

1. `#6`: Fix first. It is a concrete app-side bug in custom icon import/generation.
2. `#4`: Investigate/fix identifier collisions; split Dock close behavior if needed.
3. `#8`: Docs/warning update for iCloud, Dropbox, and CloudStorage/FileProvider paths.
4. `#7`: Docs/warning update for drag/drop limitations on symlinks, SMB, and provider paths.
5. `#10`: Docs/showcase follow-up; low risk, useful for README.

## Suggested Labels To Create

- `bug`
- `enhancement`
- `documentation`
- `showcase`
- `custom-icons`
- `finder-cache`
- `macos-limitation`
- `needs-testcase`
