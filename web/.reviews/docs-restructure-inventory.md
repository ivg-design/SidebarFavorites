# SidebarFavorites docs: restructure inventory

Read as rendered (`/docs`, `/docs/*`) and as source (`src/content/docs/*.tsx`) on 2026-10-04. A "blob" is a
passage where the reader has to parse a dense sentence to extract settings, options, steps, file formats,
permissions, menu paths or commands. Style guide: `docs-style.md`.

## Before

16 pages, 34 blobs.

| Page | Blobs | What is wrong |
|---|---|---|
| quick-start | 2 | The lede is a slogan plus a requirement. "Choose the icon" packs two icon types, two example names and a button into one step. No outcome after each step, no troubleshooting; the last section is a lone callout. |
| install | 2 | Three commands in one block with no explanation of what each does; `brew trust` explained after the fact. Requirements is a one-line section at the end. No "what you see", no troubleshooting. |
| updates | 1 | Two buttons explained in one line; "what the check does" is one sentence of four negatives. Two short sections that are one idea. |
| custom-svg-icons | 4 | Import, preview, slider and Apply as paragraphs, not steps. Warnings are a bullet list of six items with several quoted messages per bullet. The refusal messages are six quotes in one sentence. A version note in brackets. |
| cloud-folders | 2 | Two of three sections are history ("Why it did not work before 1.0", "The old symlink workaround"). What remains is one sentence. |
| disks-and-shares | 2 | The choice between the two modes is a bullet pair with the control name used as a sentence fragment. No steps, no figure, no statement of where the control is. |
| keeping-both-icons | 3 | The three choices are bullets that mix effect, mechanism and a file path. Helper facts (size, name pattern, where it appears) in one sentence. "Changing your mind" repeats "Removing a helper". |
| menu-bar-popover | 1 | Menu items as bullets with shortcuts inline. "Turning it off" is a one-line section. |
| how-it-works | 4 | A property key, a bundle path, a UTI mechanism and a 17-byte detail in running prose. "Finder restarts" is one paragraph holding three triggers and two conditions. "Where things live" repeats config.json. |
| config-json | 5 | The file listing is a code block with comments standing in for a table. Several fields per table row. Allowed values listed inside a cell. No example file. "The file is written atomically." is an orphan sentence. No recovery steps. |
| uninstalling | 2 | Step 1 holds two procedures and a parenthesis. The warning comes after the steps it qualifies. |
| building-from-source | 2 | Requirements in one sentence. Environment variables (`SIGN_IDENTITY`, `NOTARIZE`, `NOTARY_PROFILE`) explained in prose. |
| nix-flake | 1 | Three sections of one line each. |
| troubleshooting | 2 | Fixes as paragraphs with menu paths inline; no cause/fix structure. SVG problems in one sentence listing five causes. |
| faq | 0 | Short answers, which suits the page. Two answers say "No" and stop without saying what to do instead. |
| report-an-issue | 1 | "What to include" bullets hold two items each. |

Structural problems across the set:

- No page for the Settings window, although four pages send the reader there.
- Ledes are slogans or keyword lists, not a statement of what the page covers and who needs it.
- No callout names its kind; `Callout` is used as a section body on three pages.
- Code blocks have no visible label; the Files listing and the commands look the same.
- Menu paths typed with "›" or "→" in running text.
- Captions repeat the alt text ("The update notice.").
- Below 1180 px there is no "On this page" list at all.

## Version-history framing found

| Page | What it said | Where the fact went |
|---|---|---|
| cloud-folders | Section "Why it did not work before 1.0" and "The old symlink workaround". | Removed. The page states the current behaviour: cloud folders work like local ones, and why (the icon is set on the sidebar row, not on the folder). A favorite that points at a symlink keeps working, stated as a present fact. |
| cloud-folders (meta) | Excerpt "This did not work in any version before 1.0." | Removed. |
| custom-svg-icons | "(Before 1.1 this needed actool, which only exists inside Xcode.)" | Removed. The page says: no Xcode is required. |
| keeping-both-icons | "Folders without an icon of their own are added exactly as before" | Rewritten as present behaviour: such folders get no extra question. |
| nix-flake | "currently pinned to an older release" | Kept as a present fact, checked against `nix/default.nix`, with the pinned version shown as data. |
| config-json | `config.pre-1.0.json  pre-migration backup (written once)` | Kept as a file that may be present, described by what it is. The file name is data. |
| config-json | "Older config files with missing fields load without tripping this path." | Restated as a rule: every field except `id`, `name` and `folderPath` has a default. |
| how-it-works | none | |

## Contradictions between the docs and the source

See the end of this file; the list is completed as each page is rewritten.
