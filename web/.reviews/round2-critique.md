# Round 2 critique

## Verdict: not AI-slop. Distinctive, cohesive, mostly confident. Two real wobbles: the hero fold and a placeholder.

## What works
- The concept lands: the site's own nav is a cream Finder sidebar whose rows become glyphs as you read; the hero is a real dark
  Finder window on a wallpaper gradient. The first screen explains the product without a word.
- Before/After → quick-pick grid is the product in one click; the Both-icons radios change tile, row and a status line
  exactly like the app; split-flap numerals under the hood make four dry facts memorable.
- Copy is specific and honest ("17 bytes", "Nothing runs in the background. Quit the app and the icons stay.").

## Priority issues
1. **Hero vs rail at 1440.** The rail is worth it (it is the idea), but it costs the headline its width: four stacked words at
   100px, and the CTA row falls off the fold. Decision: keep the rail, keep the four-line stack as a deliberate column, and
   size the stack so eyebrow→brew chip fit in 900px. Make the stage match (600px, window at 40px).
2. **"Demo recording coming soon."** A play button that explains it does nothing. Remove the section until the recording
   exists (component stays, keyed on `DEMO_VIDEO_SRC`).
3. **Discoverability of the picker.** The best interaction on the page is invisible. Put the instruction inside the panel,
   under the After card, as a Finder-style hint, and give After rows a trailing chevron on hover.
4. **Finder mocks must use one pen.** System rows, the 404 rows, the Everywhere rows and the GitHub mark should be SF-style
   silhouettes from the same generator as the custom rows.
5. **"iCloud & CloudStorage." clips.** Use the product's own term, "Cloud folders." (README section, docs page), which also
   fits the drum.

## Minor
- Both-icons dialog figure is unreadable at 220px: crop to the warning + three choices at full column width.
- Custom icons: move the Preview toy under the screenshot it mirrors.
- "Copied" pop lands on the Download button.
- Phone docs: paths wrap mid-word.

## Questions
- Should the rail's folder→glyph progression also run in the header menu on phones? (It does, same list. Good.)
- Would the Before/After reveal be stronger if the After column morphed only when the arrow finishes? (It does: 700ms after.)
