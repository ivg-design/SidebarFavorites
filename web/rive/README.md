# folder-morph (Rive)

Morphing silhouette: folder to eight glyphs, driven by ViewModel `Morph` (number `target` 0..8, boolean `auto`).

Regenerate and build:

1. Edit shapes in `gen_shapes.py` (shapely; 8 contours x 96 points per shape).
2. `./build_morph.sh` rebuilds `folder-morph/morph.luau` from `src/*.luau` plus the generated data.
3. `rive folder-morph --verify`, then `./sheet.sh <outdir> 60` for a contact sheet of all nine shapes.
4. Ship: `rive push folder-morph` once (binds the project to a Rive file, recorded under `push:` in `folder-morph/rive.yaml`; without it the web build is watermarked and the script never draws), then `rive folder-morph --publish` and copy `folder-morph/build/folder-morph.riv` to `public/rive/folder-morph.riv`.
5. `node --test tests/rive-smoke.mjs`.

`public/rive/rive.wasm` is copied from `node_modules/@rive-app/canvas/rive.wasm`; refresh it when the runtime version changes.
