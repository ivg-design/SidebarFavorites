"""Generates shapes.luau data (equal-count outlines) for folder-morph/morph.luau.
Run: python3 gen_shapes.py > folder-morph/shapes.luau.txt  (pasted into morph.luau by build step below)"""
import math, sys
from shapely.geometry import Point, Polygon, box, LineString, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from shapely.geometry.polygon import orient

M = 96                    # points per contour
SLOTS = 8                 # 0 main, 1-2 extra exteriors, 3-7 holes
Q = 24                    # buffer quad segs

def rr(x0, y0, x1, y1, r):
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=Q)
def circ(x, y, r): return Point(x, y).buffer(r, quad_segs=Q)
def ell(x, y, rx, ry, rot=0):
    e = affinity.scale(Point(0, 0).buffer(1, quad_segs=Q), rx, ry)
    return affinity.translate(affinity.rotate(e, rot, origin=(0, 0)), x, y)
def line(pts, w): return LineString(pts).buffer(w, cap_style="round", join_style="round", quad_segs=Q)
def flat(pts, w): return LineString(pts).buffer(w, cap_style="flat", join_style="round")

def folder():
    body = rr(-88, -50, 88, 66, 12)
    tab = rr(-88, -68, -12, -30, 10)
    return unary_union([body, tab])

def hammer():
    head = Polygon([(-62, -72), (-30, -88), (52, -88), (52, -34), (-30, -34), (-56, -50)])
    head = unary_union([head, rr(-70, -76, -40, -48, 6)])
    handle = rr(-14, -40, 14, 86, 9)
    g = unary_union([head, handle])
    return affinity.rotate(g, 38, origin=(0, 0))

def note():
    h1 = ell(-52, 52, 36, 26, -22); h2 = ell(40, 32, 36, 26, -22)
    s1 = box(-24, -62, -4, 52); s2 = box(68, -82, 88, 32)
    beam = Polygon([(-24, -62), (88, -88), (88, -44), (-24, -18)])
    return unary_union([h1, h2, s1, s2, beam])

def palette():
    body = unary_union([ell(0, 0, 92, 74, -10)])
    holes = [circ(34, 36, 21), circ(-48, 0, 12), circ(-28, -38, 12), circ(14, -50, 12), circ(54, -20, 12)]
    return body.difference(unary_union(holes))

def plane():
    body = Polygon([(-92, -6), (92, -80), (34, 82), (2, 22)])
    return body.difference(flat([(-1, 20), (52, -36)], 4.5))

def branch():
    parts = [circ(-40, -58, 24), circ(-40, 58, 24), circ(46, -22, 24),
             flat([(-40, -40), (-40, 40)], 8)]
    curve = [(46, -2 + 0), (46, 20), (30, 34), (-40, 34)]
    pts = []
    # smooth curve from right node down and into stem
    for i in range(0, 21):
        t = i / 20
        x = 46 + (-40 - 46) * (t ** 2 * (3 - 2 * t))
        y = -2 + (36 - -2) * (1 - (1 - t) ** 2)
        pts.append((x, y))
    parts.append(flat(pts, 8))
    g = unary_union(parts)
    holes = [circ(-40, -58, 9), circ(-40, 58, 9), circ(46, -22, 9)]
    return g.difference(unary_union(holes))

def cloud():
    return unary_union([circ(-44, 16, 38), circ(2, -16, 52), circ(48, 14, 38),
                        rr(-76, 8, 80, 54, 23)])

def camera():
    body = rr(-92, -42, 92, 68, 16)
    bump = Polygon([(-34, -42), (-22, -66), (22, -66), (34, -42)])
    g = unary_union([body, bump])
    g = g.difference(circ(0, 14, 36)).union(circ(0, 14, 20))
    return g.difference(circ(66, -22, 6.5))

def doc_mag():
    doc = rr(-80, -86, 28, 70, 10)
    doc = doc.difference(circ(32, 26, 52))
    for y in (-50, -22):
        doc = doc.difference(flat([(-56, y), (-12, y)], 5.5))
    ring = circ(32, 26, 38).difference(circ(32, 26, 21))
    handle = line([(60, 54), (86, 80)], 9.5)
    return unary_union([doc, ring, handle])

SHAPES = [folder, hammer, note, palette, plane, branch, cloud, camera, doc_mag]
NAMES = ["folder", "hammer", "note", "palette", "plane", "branch", "cloud", "camera", "doc"]

def normalise(geoms):
    allg = unary_union(geoms)
    x0, y0, x1, y1 = allg.bounds
    s = min(170 / (y1 - y0), 176 / (x1 - x0))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return [affinity.translate(affinity.scale(g, s, s, origin=(cx, cy)), -cx, -cy) for g in geoms]

def rings_of(g):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    polys = sorted(polys, key=lambda p: -p.area)
    ext, holes = [], []
    for p in polys:
        p = orient(p, sign=1.0)
        ext.append(list(p.exterior.coords)[:-1])
        for i in p.interiors:
            holes.append(list(i.coords)[:-1])
    return ext, holes

def area(r): return abs(sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r))))/2
def cent(r): return (sum(p[0] for p in r)/len(r), sum(p[1] for p in r)/len(r))

def resample(ring, want_cw):
    # orientation: make signed area sign consistent
    sa = sum(ring[i][0]*ring[(i+1)%len(ring)][1]-ring[(i+1)%len(ring)][0]*ring[i][1] for i in range(len(ring)))
    if (sa > 0) != want_cw: ring = ring[::-1]
    n = len(ring)
    # corner detection
    pts = ring + [ring[0]]
    seg = [math.dist(pts[i], pts[i+1]) for i in range(n)]
    total = sum(seg)
    cum = [0]
    for s in seg: cum.append(cum[-1] + s)
    corners = []
    for i in range(n):
        a, b, c = ring[i-1], ring[i], ring[(i+1) % n]
        v1 = (b[0]-a[0], b[1]-a[1]); v2 = (c[0]-b[0], c[1]-b[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        if l1 < 1e-6 or l2 < 1e-6: continue
        cosang = (v1[0]*v2[0]+v1[1]*v2[1])/(l1*l2)
        if cosang < math.cos(math.radians(32)): corners.append(cum[i])
    # start at topmost point (min y), so rings align
    ys = [p[1] for p in ring]; i0 = min(range(n), key=lambda i: (round(ys[i], 3), ring[i][0]))
    start = cum[i0]
    ts = [(start + total * k / M) % total for k in range(M)]
    # snap nearest samples to corners
    used = set()
    for cpos in corners:
        best = min((k for k in range(M) if k not in used), key=lambda k: min(abs(ts[k]-cpos), total-abs(ts[k]-cpos)))
        ts[best] = cpos; used.add(best)
    ts.sort(key=lambda t: (t - start) % total)
    out = []
    j = 0
    for t in ts:
        # locate segment
        lo, hi = 0, n
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if cum[mid] <= t: lo = mid
            else: hi = mid
        f = (t - cum[lo]) / seg[lo] if seg[lo] else 0
        a, b = pts[lo], pts[lo+1]
        out.append((a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f))
    return out

def build():
    result = []
    for fn in SHAPES:
        g = fn()
        g = normalise([g])[0]
        ext, holes = rings_of(g)
        assert len(ext) <= 3 and len(holes) <= 5, (fn.__name__, len(ext), len(holes))
        main_c = cent(ext[0])
        slots = []
        for i in range(3):
            slots.append(resample(ext[i], True) if i < len(ext) else [main_c]*M)
        hs = sorted(holes, key=lambda r: -area(r))
        for i in range(5):
            slots.append(resample(hs[i], False) if i < len(hs) else [main_c]*M)
        result.append(slots)
    return result

if __name__ == "__main__":
    data = build()
    out = ["-- GENERATED by rive/gen_shapes.py: do not edit. 9 shapes x %d contours x %d points (x,y pairs, centre 0,0), as strings." % (SLOTS, M)]
    out.append("local DATA: { { string } } = {")
    for si, slots in enumerate(data):
        out.append("    { -- %s" % NAMES[si])
        for sl in slots:
            out.append('        "' + ",".join("%.1f,%.1f" % p for p in sl) + '",')
        out.append("    },")
    out.append("}")
    sys.stdout.write("\n".join(out) + "\n")
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        pass
