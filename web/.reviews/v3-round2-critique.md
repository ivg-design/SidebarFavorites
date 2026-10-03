# v3 round two — critique (as the owner would judge it)

## Anti-patterns verdict
Pass, with one asterisk. The fold is not an AI page: a Finder sidebar at 2.3× bleeding off the left edge, a grey
world that gains colour row by row, a headline whose last word is seven folders until the product resolves it.
Nobody's template does that. The asterisk: the wallpaper is blue→violet→magenta→orange, i.e. the gradient every
AI reaches for. It is excused — it is the owner's own capture backdrop, and it only ever sits behind a dark
window — but it is the one thing a stranger could point at. Below the fold the page is a well-made product page:
it does not fail the slop test, but it stops surprising.

## Overall impression
The hero is the best thing any of the three versions has had, and it is 80 % there: first frame striking, the
move premium (nothing bounces; folders dissolve into glyphs with 1.5 px of blur, the colour floods in step), the
word "legible" lands — but a letterspaced italic cheapens it by a hair, and the zoom-out is two overlapping things
for a fifth of its length (see audit A1). The page after the fold keeps the *language* (one ease, one verb, the
Finder kit, mono names) but loses the *energy*: between the hero and Install, eight captures sit in eight vivid
panels in zigzag, and the only motion is a 12 px fade.

## What works
1. The concept is true to the product: one move (grey folder → glyph), one claim (legible), shown on the real object
   at poster scale, resolving into the owner's own screenshot style. That is the memorable thing.
2. The interactive sections are real: the hero picker, the symbol search over 9,184 names, the drop zone that
   flattens a real SVG, the Everywhere rows and switch, the Both switch, the hood tree. Nothing is hoverable for
   nothing.
3. The type system holds: Schibsted 700 tight, Newsreader once, JetBrains Mono for names, SF inside mocks. The 404
   ("Not in the sidebar.") and the Install band are confident and quiet.

## Priority issues
1. **The zoom-out reads as two things** (0.7–0.95). What: ghosted double sidebar. Why: it is the one camera move
   the page promises, and a motion designer sees the seam first. Fix: land the column early, grow the chrome around
   it, hard-swap. Done — see audit A1.
2. **The illegible word is undersized and the legible one is letterspaced.** The folders sit at 0.4 em centred in a
   0.92 line, so the third line at t=0 reads "a row of small icons" rather than "a word I cannot read"; after the
   move, `legible` is tracked +0.06 em. Fix: folders on the baseline at x-height, no letter padding. Done.
3. **Energy drops after the fold.** Eight vivid-panel captures, same shape, no motion. Fix, in the same language:
   every capture and every vivid panel *resolves* on entry the way the hero does — grey and 1.5 px soft → colour and
   sharp, 420 ms, one ease, once — so the page re-enacts "colour arrives with the move" each time a window appears.
   Not louder; the same verb. Done (`Shot`/`Vivid` resolve).
4. **The symbols band is composed as header-then-widget.** 180 px of empty graphite above the title, empty right
   half, then the wall starts below the lede. Fix: the wall is the band's texture — it runs behind the title and the
   panel, edge to edge, dimmed; the title and the search float on it. Done.
5. **Two claims were not the app's** (SVG warnings, quick picks). The owner reads his own strings; he will notice.
   Fixed with the app's verbatim sentences and its real 24 picks in 8 × 3.

## Minor observations
- The hero picker covers "finally" at 1440 — acceptable (it is a popover beside the row), but the popover's 272 px
  width at scale 1.7 is large; it now scales to the row's 24-px grid with the 8-wide grid.
- "Click +" as an h3 after the hero's "Pick a folder. Pick an icon. Add." is right (the hero's end *is* this
  section's title), but it means the section opens with a small heading and a large capture; the resolve on the
  capture now gives it a beat.
- Phone: the CTA sits below the first screen (the column fills it). Defensible — the move is the pitch — and the
  hint + Replay row keeps the user on the object.

## Questions
- Would the owner accept captures on paper (hairline frame) for *static* screenshots and the wallpaper only under
  *live* mocks? It would halve the gradient count and make "vivid = alive" a rule. Not done: it changes his house
  style without asking.
