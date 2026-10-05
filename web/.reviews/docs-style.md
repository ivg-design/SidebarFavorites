# SidebarFavorites docs: style guide

One page. Every file in `src/content/docs/*.tsx` follows it. Components are in `src/components/docs/`, styles at
the end of `src/app/docs/docs.css`. The landing page and its components are not part of the docs and are not touched.

## What the docs are

The docs describe SidebarFavorites as it is now, in the present tense. They are not a changelog. No "new in",
"since", "as of", "before 1.x", "previously", "used to", "no longer", "replaces", no migration notes, no "what's
new" sections. No version numbers except the system requirement (macOS 13), macOS 26 where a behaviour belongs
to that system, and a version that is itself data (a file name such as `config.pre-1.0.json`, the `version`
field). History lives on `/changelog`; a page may link to it once. `tests/docs.mjs` fails on these patterns.

## Page shape

1. `meta.description` is the opening paragraph (it renders as the lede): what the page covers and who needs it.
2. Concepts in plain words before any list of settings: what the thing is, why it exists, when you use it.
3. Then the body in one of the shapes below. `H2` then `H3`, never skipping, sentence case. `meta.sections`
   lists every `H2` in order with the same ids; it feeds both "On this page" lists.
4. No section holds a single line. Fold it into its neighbour or give it the explanation it lacks.
5. A page that asks the reader to do something ends with an `H2` "If it does not work".

## How-to shape

```tsx
<Steps>
  <Step title={<>Click <strong>+</strong> in the manager window, or press <Kbd>⌘N</Kbd>.</>} see="The favorite editor opens in its own window.">
    <p>Optional explanation, a figure or a code block.</p>
  </Step>
</Steps>
```

- One action per step. The title is the action, in the imperative, with the exact control in `<strong>`.
- A menu or settings path is `<MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />`.
  Keys are `<Kbd>`.
- `see` says what the reader sees after the step. Leave it out only when nothing visible changes.

## Settings and options shape

`<Table>` with the columns Setting, What it does, Default, When to change it. Every cell is a short full
sentence. For a choice between options: Option, What it does, Choose it when. If one setting needs more room
than a cell, give it an `H3` with a paragraph and keep the table for the rest.

## Reference shape (config file, files on disk, commands, messages)

One item per block: an `H3`, one sentence saying what it is for, a `<Table>` of its fields (Field, Type, What it
holds, Default), a minimal valid example in a `<CodeBlock lang="json">`, then a realistic example. Never a list
of fields or allowed values in a sentence; never two fields in one table row.

## Callouts

One component, three kinds, each named in words on the callout: `<Callout kind="note">`, `<Callout kind="tip">`,
`<Callout kind="warn">`. At most two per page. A callout never carries a step or a setting.

## Figures

A page that describes something the reader sees shows it: the manager window, the favorite editor, the symbol
browser, the SVG import sheet, the Settings window, the menu bar menu, Finder's sidebar before and after. The
figure comes directly after the sentence that introduces the thing; a how-to has one at each step where the
screen changes.

```tsx
<Figure shot="SBFSettings" alt="What the image contains, for someone who cannot see it" caption={<>What to look at, with <strong>control names</strong> as the image shows them.</>} />
```

- Only the real captures in `public/shots/`. The fresh set is listed in `public/shots/manifest.json` (file, 2x
  file, size, appearance, a `shows` sentence) and arrives framed on a gradient with a shadow. Never edit, reframe
  or generate an image. If nothing shows what a page describes, the page goes without and the shot goes on the
  wish-list in `.reviews/docs-restructure-inventory.md` (page, sentence, window, state).
- Names in the text match the labels visible in the image, character for character.
- The alt text describes the image; the caption tells the reader what to look at. They differ.
- `Figure` reads the manifest: width and height (no layout shift), 1x and 2x, a `name-dark` twin, lazy loading,
  and an enlarge dialog on click. It adds no background, border or shadow to a framed capture.

## Tables and code

- No horizontal scrolling at 1440, 1280, 1024, 834 and 390 (`tests/docs-no-hscroll.mjs`). Tables have at most
  four columns and restack into labelled cards on phones. Code tokens in cells break at separators.
- Every `<CodeBlock>` has a `lang` (`bash`, `json`, `files`, `text`, `nix`); `title` names the file. Commands
  use `prompt` and never type the `$`. Examples are real and valid: JSON that the app decodes, a path that exists.

## Language

- Plain, grammatical, factual. Say why as well as what. Second person, present tense, active voice.
- No marketing words (simple, powerful, seamless, just, easily), no time or effort estimates, no em dashes.
- Proper nouns exact and unbroken: SidebarFavorites, Finder, SF Symbols, Homebrew, IVG Design, System Settings.
- UI strings exactly as the app shows them: `<strong>` for controls, `<q>` for messages.
- Never a real secret, Apple ID, team id or personal path. Use `you@example.com`, `TEAMID`, `~/Projects`.

## Truth

Every statement is checked against `SidebarFavoritesManager/**`. If the code and the page disagree, the code
wins and the contradiction is recorded in `.reviews/docs-restructure-inventory.md`.
