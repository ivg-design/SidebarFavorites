"""Emits src/components/glyphs-sf.tsx: filled SF-style silhouettes as 0..16 viewBox path data.
Run: python3 gen_sf.py > ../src/components/glyphs-sf.tsx"""
import math, json
from shapely.geometry import Polygon, box, MultiPolygon, LineString
from shapely.ops import unary_union
from shapely import affinity
from gen_shapes import (rr, circ, ell, line, flat, folder, hammer, note, palette, plane, branch,
                        cloud, camera, doc_mag)

def star():
    pts = []
    for i in range(10):
        r = 92 if i % 2 == 0 else 40
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((r * math.cos(a), r * math.sin(a)))
    return Polygon(pts).buffer(-6, join_style="mitre").buffer(9, quad_segs=12).buffer(-3, quad_segs=12)

def heart():
    g = unary_union([circ(-40, -32, 42), circ(40, -32, 42), Polygon([(-80, -12), (80, -12), (0, 84)]), box(-40, -50, 40, 0)])
    return g.buffer(-6, quad_segs=12).buffer(6, quad_segs=12)

def bookmark():
    return Polygon([(-50, -88), (50, -88), (50, 88), (0, 44), (-50, 88)]).buffer(-5, join_style="mitre").buffer(7, quad_segs=10)

def flag():
    wave = Polygon([(-52, -80), (78, -80), (46, -38), (78, 4), (-52, 4)]).buffer(-4, join_style="mitre").buffer(4, quad_segs=8)
    return unary_union([rr(-74, -88, -50, 90, 10), wave])

def tag():
    body = Polygon([(-88, 0), (-34, -56), (82, -56), (82, 56), (-34, 56)]).buffer(-8, join_style="mitre").buffer(8, quad_segs=10)
    body = body.difference(circ(-40, 0, 12))
    return affinity.rotate(body, -35, origin=(0, 0))

def archive():
    lid = rr(-92, -72, 92, -20, 8)
    body = rr(-78, -8, 78, 76, 10).difference(rr(-26, 12, 26, 30, 8))
    return unary_union([lid, body])

def briefcase():
    body = rr(-92, -40, 92, 78, 14).difference(rr(-12, -2, 12, 16, 5))
    handle = rr(-38, -78, 38, -28, 12).difference(box(-22, -64, 22, -20))
    return unary_union([body, handle])

def folder_fill():
    return folder().difference(flat([(-88, -26), (-10, -26)], 3.2))

# ---- Outline-style system glyphs: centreline strokes, radius R in the 200-unit space (about 1.3 units on the 16 grid after fit)
R = 8.8
def pl(pts, closed=False):
    return LineString(pts + [pts[0]] if closed else pts).buffer(R, cap_style="round", join_style="round", quad_segs=Q)
def ring(shape): return pl(list(shape.exterior.coords)[:-1], True)
def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy - r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
def U(*g): return unary_union(list(g))
Q = 24

def airdrop():
    return U(circ(0, 0, 17), pl(arc(0, 0, 48, 40, -40)), pl(arc(0, 0, 83, 42, -42)),
             pl(arc(0, 0, 48, 140, 220)), pl(arc(0, 0, 83, 138, 222)))

def clock():
    return U(ring(circ(0, 0, 83)), pl([(0, -46), (0, 2), (36, 2)]))

def desktop():
    return U(ring(rr(-82, -78, 82, 30, 14)), pl([(0, 30), (0, 76)]), pl([(-34, 78), (34, 78)]))

def doctext():
    return U(pl([(-58, -82), (14, -82), (58, -38), (58, 82), (-58, 82)], True),
             pl([(14, -82), (14, -38), (58, -38)]), pl([(-26, 8), (26, 8)]), pl([(-26, 44), (12, 44)]))

def arrow_down_circle():
    return U(ring(circ(0, 0, 83)), pl([(0, -42), (0, 42)]), pl([(-30, 12), (0, 42), (30, 12)]))

def icloud_up():
    c = U(circ(-44, 16, 38), circ(2, -16, 52), circ(48, 14, 38), rr(-76, 8, 80, 54, 23))
    c = affinity.scale(c, 1.0, 1.0)
    from shapely.geometry import Polygon as P
    return U(ring(P(c.exterior.coords)), pl([(0, 36), (0, -4)]), pl([(-22, 14), (0, -8), (22, 14)]))

def globe():
    return U(ring(circ(0, 0, 83)), ring(ell(0, 0, 38, 83)), pl([(-83, 0), (83, 0)]))

def extdrive():
    return U(ring(rr(-84, -80, 84, -14, 14)), circ(50, -47, 9), pl([(0, -14), (0, 42)]), pl([(-58, 42), (58, 42)]),
             circ(-62, 42, 17), circ(62, 42, 17))

def house():
    return U(pl([(-86, -6), (0, -80), (86, -6)]), pl([(-58, -32), (-58, 80), (58, 80), (58, -32)]),
             pl([(-18, 80), (-18, 34), (18, 34), (18, 80)]))

def book():
    return U(pl([(0, -48), (-82, -74), (-82, 58), (0, 84), (82, 58), (82, -74), (0, -48)]), pl([(0, -48), (0, 84)]))

def clock_history():
    a = arc(0, 0, 83, -150, 150, 72)
    px, py = a[-1]; qx, qy = a[-2]
    dx, dy = px - qx, py - qy; l = math.hypot(dx, dy); dx, dy = dx / l, dy / l
    def rot(v, deg):
        c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg)); return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)
    h1 = rot((-dx, -dy), 42); h2 = rot((-dx, -dy), -42)
    head = pl([(px + 34 * h1[0], py + 34 * h1[1]), (px, py), (px + 34 * h2[0], py + 34 * h2[1])])
    return U(pl(a), head, pl([(0, -36), (0, 2), (30, 2)]))

def photo():
    box_ = rr(-86, -76, 86, 76, 18)
    mount = pl([(-90, 48), (-34, -2), (0, 30), (34, -4), (90, 52)]).intersection(box_)
    return U(ring(box_), mount, circ(-40, -34, 14))

def grid22():
    return U(rr(-88, -88, -8, -8, 22), rr(8, -88, 88, -8, 22), rr(-88, 8, -8, 88, 22), rr(8, 8, 88, 88, 22))

GITHUB = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 4.21 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z"

def github_d():
    """Hand data: Simple Icons GitHub mark (24 grid) rescaled to the 16 grid, 1 unit padding. Relative commands scale only."""
    import re
    k = 14 / 24.0; ox = 1.0; oy = 1.0 - 0.297 * k + 0.0
    toks = re.findall(r"[a-zA-Z]|-?\d*\.?\d+", GITHUB)
    out, cmd, i = [], None, 0
    nargs = {"M": 2, "m": 2, "c": 6, "C": 6, "s": 4, "S": 4, "l": 2, "L": 2, "z": 0, "Z": 0}
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]; i += 1; out.append(cmd)
            if cmd in "zZ": continue
        n = nargs[cmd]; v = [float(t) for t in toks[i:i + n]]; i += n
        if cmd.isupper():
            v = [x * k + (ox if j % 2 == 0 else oy) for j, x in enumerate(v)]
        else:
            v = [x * k for x in v]
        out.append(",".join(fmt(x) for x in v))
        if cmd == "M": cmd = "L"
        if cmd == "m": cmd = "l"
    return " ".join(out)

SF = [
    ("folder", folder), ("hammer.fill", hammer), ("music.note", note), ("paintpalette", palette),
    ("paperplane.fill", plane), ("arrow.triangle.branch", branch), ("icloud", cloud), ("camera", camera),
    ("doc.text.magnifyingglass", doc_mag),
    ("star.fill", star), ("heart.fill", heart), ("bookmark.fill", bookmark), ("flag.fill", flag),
    ("tag.fill", tag), ("archivebox.fill", archive), ("briefcase.fill", briefcase), ("folder.fill", folder_fill),
    ("dot.radiowaves.left.and.right", airdrop), ("clock", clock), ("desktopcomputer", desktop), ("doc.text", doctext),
    ("arrow.down.circle", arrow_down_circle), ("icloud.and.arrow.up", icloud_up), ("globe", globe),
    ("externaldrive.connected.to.line.below", extdrive), ("house", house), ("book", book),
    ("clock.arrow.circlepath", clock_history), ("photo", photo), ("square.grid.2x2", grid22),
]

def fit(g, pad=1.0):
    x0, y0, x1, y1 = g.bounds
    s = (16 - 2 * pad) / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return affinity.translate(affinity.scale(g, s, s, origin=(cx, cy)), 8 - cx, 8 - cy)

def fmt(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def to_d(g):
    g = g.simplify(0.035)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    for p in polys:
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)[:-1]
            out.append("M" + "L".join("%s %s" % (fmt(x), fmt(y)) for x, y in c) + "Z")
    return "".join(out)

if __name__ == "__main__":
    print('// GENERATED by rive/gen_sf.py: do not edit. Filled SF-style silhouettes, 0..16 viewBox, evenodd.')
    print('export const SF_PATHS: Record<string, { d: string; evenodd?: boolean }> = {')
    for name, fn in SF:
        d = to_d(fit(fn()))
        print('  %s: { d: "%s", evenodd: true },' % (json.dumps(name), d))
    print('  "custom.github": { d: "%s", evenodd: true },' % github_d())
    print('};\n')
    print('export function SfGlyph({ name, size = 16, className }: { name: string; size?: number; className?: string }) {')
    print('  const g = SF_PATHS[name];')
    print('  if (!g) return null;')
    print('  return (')
    print('    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>')
    print('      <path d={g.d} fillRule={g.evenodd ? "evenodd" : "nonzero"} />')
    print('    </svg>')
    print('  );')
    print('}')
