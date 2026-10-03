#!/bin/sh
# Regenerates folder-morph/morph.luau = header + generated shape data + body.
cd "$(dirname "$0")" && { cat src/morph.head.luau; python3 gen_shapes.py; cat src/morph.body.luau; } > folder-morph/morph.luau
