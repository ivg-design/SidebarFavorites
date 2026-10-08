// The executable inside every spacer app (#23).
//
// A spacer's sidebar row points at a tiny background-only app rather than a
// folder: clicking a folder row navigates to it and highlights the row, while
// clicking an app row launches the app and leaves Finder where it was. With the
// row's icon override set to the blank glyph, even Finder's launch zoom has
// nothing to draw. So the app does nothing at all - it exits the moment it starts.
//
// Built by the "Build FinderSync Template" phase into the same Resources folder
// as the Finder Sync helpers, which is what gets every *-bin there signed for
// notarization by scripts/build-release.sh.
int main(void) {
    return 0;
}
