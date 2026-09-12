import math, json

def taper(t, head=0.12, tail=0.30):
    """Brush pressure: quick bite at the head, long dry lift at the tail."""
    if t < head:  return (t/head)**0.55
    if t > 1-tail: return max(0.0, ((1-t)/tail)**1.35)
    return 1.0

def ribbon(pts_fn, n, w_fn):
    """Build a filled outline by walking a centreline and offsetting by w/2 on each normal."""
    outer, inner = [], []
    for i in range(n+1):
        t = i/n
        (x, y), (nx, ny) = pts_fn(t)
        w = w_fn(t)/2
        outer.append((x+nx*w, y+ny*w))
        inner.append((x-nx*w, y-ny*w))
    pts = outer + inner[::-1]
    d = "M%.2f,%.2f " % pts[0] + " ".join("L%.2f,%.2f" % p for p in pts[1:]) + " Z"
    return d

def enso(R=250, cx=270, cy=270, sweep=333, start=-104, base=30):
    a0, a1 = math.radians(start), math.radians(start+sweep)
    def cl(t):
        a = a0 + (a1-a0)*t
        # wobble the radius so the ring is hand-drawn, not compass-drawn
        r = R * (1 + 0.020*math.sin(a*2.3+1.1) + 0.012*math.sin(a*4.7))
        return (cx + r*math.cos(a), cy + r*math.sin(a)), (math.cos(a), math.sin(a))
    def w(t):
        a = a0 + (a1-a0)*t
        return base * taper(t) * (0.62 + 0.38*abs(math.sin(a*1.6+0.6)) + 0.16*math.sin(a*3.1))
    return ribbon(cl, 260, w)

def stroke_h(L=600, H=9, base=7.0, wobble=1.5):
    """Horizontal brush rule — bites in, thins away."""
    def cl(t):
        return (t*L, H/2 + wobble*math.sin(t*5.2+0.7)), (0.0, 1.0)
    def w(t):
        return base * taper(t, 0.05, 0.55) * (0.72 + 0.28*math.sin(t*9.1+2.0))
    return ribbon(cl, 200, w)

def stroke_v(L=900, W=10, base=5.0):
    """Vertical brush rule for the spine edge."""
    def cl(t):
        return (W/2 + 1.6*math.sin(t*6.1+0.4), t*L), (1.0, 0.0)
    def w(t):
        return base * taper(t, 0.03, 0.10) * (0.70 + 0.30*math.sin(t*13.0+1.2))
    return ribbon(cl, 300, w)

def bar(L=100, H=10, base=8.0):
    """Timeline bar with brushed, slightly uneven ends."""
    def cl(t):
        return (t*L, H/2 + 0.5*math.sin(t*4.0)), (0.0, 1.0)
    def w(t):
        return base * taper(t, 0.06, 0.10) * (0.86 + 0.14*math.sin(t*11.0))
    return ribbon(cl, 120, w)

out = {"enso": enso(), "rule": stroke_h(), "vrule": stroke_v(), "bar": bar()}
for k, v in out.items():
    print(k, len(v), "chars")
json.dump(out, open('/tmp/claude-0/-home-user-mitsuketa/f570d07e-48ce-57c7-ab7a-abdddf50d5f4/scratchpad/brush.json','w'))
