#!/bin/sh
# usage: sheet.sh outdir advance  -> outdir/sheet.png contact sheet of the nine targets (dark bg)
O=$1; A=${2:-60}; mkdir -p $O
for i in 0 1 2 3 4 5 6 7 8; do rive "$(dirname $0)/folder-morph" --screenshot=$O/s$i.png --advance=$A --data=target=$i >/dev/null 2>&1; done
python3 - "$O" <<'PY'
import sys
from PIL import Image
o=sys.argv[1]; W=Image.new("RGB",(720,720),(40,40,46))
for i in range(9):
    im=Image.open(f"{o}/s{i}.png").convert("RGBA")
    bg=Image.new("RGBA",im.size,(40,40,46,255)); bg.alpha_composite(im)
    W.paste(bg.convert("RGB"),((i%3)*240,(i//3)*240))
W.save(f"{o}/sheet.png")
PY
