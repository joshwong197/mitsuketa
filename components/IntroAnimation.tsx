import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Session-storage key the integration agent uses to gate the intro
 * (play once per session). Gating itself is handled outside this component.
 */
export const INTRO_SEEN_KEY = 'mitsuketa_intro_seen';

interface IntroAnimationProps {
  onComplete: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 1200;
const H = 800;
const CX = W / 2;
const CY = H / 2;

const svgEl = (name: string, attrs: Record<string, string | number>) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  return n;
};

/**
 * Full-screen intro overlay, ported from design/mockups/intro-animation.html
 * and re-dyed to the sumi tokens (SUMI_SPEC.md §3 "Intro animation").
 * Choreography: glass darts to 4 spots → glides to center → press + 3 ripples
 * → web draws outward in layers → web dims → title reveal → fade out → onComplete.
 * Click anywhere or Escape skips. prefers-reduced-motion shows the final
 * state ~800ms then completes.
 */
export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SVGSVGElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);
  const [fading, setFading] = useState(false);

  // Mutable refs shared between the effect and the skip handler
  const doneRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback((fadeMs: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Stop any pending steps in the choreography
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    setTitleVisible(true);
    setFading(true);
    if (overlayRef.current) {
      overlayRef.current.style.transitionDuration = `${fadeMs}ms`;
    }
    window.setTimeout(() => onCompleteRef.current(), fadeMs);
  }, []);

  const skip = useCallback(() => finish(200), [finish]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const timeouts = timeoutsRef.current;
    const animations = animationsRef.current;
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, ms);
        timeouts.push(t);
      });

    const track = (a: Animation) => {
      animations.push(a);
      return a;
    };

    /* ---------- graph generation (deterministic, seeded LCG) ---------- */
    let seed = 42;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    type IntroNode = { x: number; y: number; r: number; layer: number; kind: 'seal' | 'person' | 'company' };
    type IntroEdge = { from: number; to: number; layer: number; cross?: boolean };

    function buildGraph() {
      const nodes: IntroNode[] = [{ x: CX, y: CY, r: 13, layer: 0, kind: 'seal' }];
      const layers = [
        { count: 6, radius: 120, r: [6.5, 9] as const },
        { count: 12, radius: 225, r: [4.5, 6.5] as const },
        { count: 14, radius: 330, r: [3, 4.5] as const },
      ];
      const edges: IntroEdge[] = [];
      let prevStart = 0;
      let prevCount = 1;

      layers.forEach((L, li) => {
        const start = nodes.length;
        for (let i = 0; i < L.count; i++) {
          const angle = (i / L.count) * Math.PI * 2 + rand() * 0.5 - 0.25 + li * 0.35;
          const radius = L.radius + (rand() - 0.5) * L.radius * 0.28;
          const x = CX + Math.cos(angle) * radius * 1.25; // widescreen stretch
          const y = CY + Math.sin(angle) * radius * 0.82;
          const kind = rand() < 0.3 ? 'person' : 'company';
          nodes.push({ x, y, r: L.r[0] + rand() * (L.r[1] - L.r[0]), layer: li + 1, kind });
          // connect to nearest node in previous layer
          let best = prevStart;
          let bd = Infinity;
          for (let p = prevStart; p < prevStart + prevCount; p++) {
            const d = (nodes[p].x - x) ** 2 + (nodes[p].y - y) ** 2;
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          edges.push({ from: best, to: nodes.length - 1, layer: li + 1 });
        }
        // a few cross-links within the layer for "complex web" feel
        for (let i = 0; i < Math.floor(L.count / 4); i++) {
          const a = start + Math.floor(rand() * L.count);
          const b = start + Math.floor(rand() * L.count);
          if (a !== b) edges.push({ from: a, to: b, layer: li + 1, cross: true });
        }
        prevStart = start;
        prevCount = L.count;
      });
      return { nodes, edges };
    }

    /* ---------- scene construction (re-dyed to tokens) ---------- */
    scene.innerHTML = '';
    scene.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const { nodes, edges } = buildGraph();

    const webGroup = svgEl('g', {}) as SVGGElement;
    const rippleGroup = svgEl('g', {}) as SVGGElement;
    scene.appendChild(webGroup);
    scene.appendChild(rippleGroup);

    // edges under nodes — crosslinks in ink-wash, main links in ink-pale
    edges.forEach((e) => {
      const a = nodes[e.from];
      const b = nodes[e.to];
      const mx = (a.x + b.x) / 2 + (rand() - 0.5) * 34;
      const my = (a.y + b.y) / 2 + (rand() - 0.5) * 34;
      const path = svgEl('path', {
        class: 'intro-edge',
        d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`,
        fill: 'none',
        stroke: e.cross ? 'var(--ink-wash)' : 'var(--ink-pale)',
        'stroke-width': e.cross ? 0.8 : 1.2,
        opacity: e.cross ? 0.4 : 0.75,
        'data-layer': e.layer,
      }) as SVGPathElement;
      webGroup.appendChild(path);
      const L = path.getTotalLength();
      path.setAttribute('stroke-dasharray', String(L));
      path.setAttribute('stroke-dashoffset', String(L));
    });

    // nodes — seal in accent, person outlines ink-mid, company fills ink-pale
    nodes.forEach((n) => {
      let shape: SVGElement;
      if (n.kind === 'seal') {
        shape = svgEl('g', { class: 'intro-node', 'data-layer': 0 });
        shape.appendChild(svgEl('circle', { cx: n.x, cy: n.y, r: n.r, fill: 'var(--accent)' }));
        shape.appendChild(
          svgEl('circle', {
            cx: n.x,
            cy: n.y,
            r: n.r + 6,
            fill: 'none',
            stroke: 'var(--accent)',
            'stroke-width': 1.5,
            opacity: 0.5,
          })
        );
      } else if (n.kind === 'person') {
        shape = svgEl('circle', {
          class: 'intro-node',
          cx: n.x,
          cy: n.y,
          r: n.r,
          fill: 'none',
          stroke: 'var(--ink-mid)',
          'stroke-width': 1.4,
          'data-layer': n.layer,
          opacity: 0.9,
        });
      } else {
        shape = svgEl('circle', {
          class: 'intro-node',
          cx: n.x,
          cy: n.y,
          r: n.r,
          fill: 'var(--ink-pale)',
          'data-layer': n.layer,
          opacity: 0.9,
        });
      }
      (shape as SVGGraphicsElement).style.transformBox = 'fill-box';
      (shape as SVGGraphicsElement).style.transformOrigin = 'center';
      (shape as SVGGraphicsElement).style.transform = 'scale(0)';
      webGroup.appendChild(shape);
    });

    // magnifying glass — strokes in ink
    const glassGroup = svgEl('g', { class: 'intro-glass' }) as SVGGElement;
    const glassInner = svgEl('g', { class: 'intro-glass-inner' }) as SVGGElement;
    glassInner.appendChild(
      svgEl('circle', { cx: 0, cy: 0, r: 36, fill: 'transparent', stroke: 'var(--ink)', 'stroke-width': 3.5 })
    );
    glassInner.appendChild(
      svgEl('path', {
        d: 'M -14 -20 A 26 26 0 0 1 12 -22',
        fill: 'none',
        stroke: 'var(--ink)',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        opacity: 0.45,
      })
    );
    glassInner.appendChild(
      svgEl('line', { x1: 26, y1: 26, x2: 56, y2: 56, stroke: 'var(--ink)', 'stroke-width': 7, 'stroke-linecap': 'round' })
    );
    glassGroup.appendChild(glassInner);
    glassGroup.style.transform = `translate(${CX - 280}px, ${CY - 130}px)`;
    scene.appendChild(glassGroup);

    /* ---------- animation helpers ---------- */
    function moveGlass(x: number, y: number, dur: number, easing = 'cubic-bezier(0.22, 1, 0.36, 1)') {
      const anim = track(
        glassGroup.animate(
          [{ transform: glassGroup.style.transform }, { transform: `translate(${x}px, ${y}px)` }],
          { duration: dur, easing, fill: 'forwards' }
        )
      );
      glassGroup.style.transform = `translate(${x}px, ${y}px)`;
      return anim.finished;
    }

    function ripple(delay: number, maxR: number, dur: number, width: number, opacity: number) {
      const c = svgEl('circle', {
        cx: CX,
        cy: CY,
        r: 8,
        fill: 'none',
        stroke: 'var(--accent)',
        'stroke-width': width,
      });
      rippleGroup.appendChild(c);
      track(
        c.animate([{ r: 8, opacity } as Keyframe, { r: maxR, opacity: 0 } as Keyframe], {
          duration: dur,
          delay,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        })
      )
        .finished.then(() => c.remove())
        .catch(() => {});
    }

    function revealWeb() {
      for (let layer = 0; layer <= 3; layer++) {
        const base = 120 + (layer - 1) * 420;
        webGroup.querySelectorAll<SVGPathElement>(`.intro-edge[data-layer="${layer}"]`).forEach((p, i) => {
          track(
            p.animate(
              [{ strokeDashoffset: p.getAttribute('stroke-dashoffset') as string }, { strokeDashoffset: 0 }],
              { duration: 650, delay: base + i * 28, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' }
            )
          );
        });
        webGroup.querySelectorAll<SVGGraphicsElement>(`.intro-node[data-layer="${layer}"]`).forEach((n, i) => {
          track(
            n.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
              duration: 480,
              delay: (layer === 0 ? 0 : base + 220) + i * 30,
              easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
              fill: 'forwards',
            })
          );
        });
      }
    }

    function finalState() {
      webGroup.querySelectorAll<SVGPathElement>('.intro-edge').forEach((p) => p.setAttribute('stroke-dashoffset', '0'));
      webGroup.querySelectorAll<SVGGraphicsElement>('.intro-node').forEach((n) => {
        n.style.transform = 'scale(1)';
      });
      glassGroup.style.opacity = '0';
      webGroup.style.opacity = '0.35';
      setTitleVisible(true);
    }

    /* ---------- the sequence ---------- */
    async function run() {
      if (reduced) {
        // Skip animation: show final state briefly, then complete
        finalState();
        await wait(800);
        if (!cancelled) finish(300);
        return;
      }

      // 1. dart around, searching
      const spots: Array<[number, number]> = [
        [CX + 230, CY - 150],
        [CX - 180, CY + 120],
        [CX + 160, CY + 140],
        [CX - 260, CY - 60],
      ];
      await wait(500);
      for (const [x, y] of spots) {
        if (cancelled || doneRef.current) return;
        await moveGlass(x, y, 520);
        await wait(320); // pause, "inspecting"
      }
      if (cancelled || doneRef.current) return;

      // 2. glide to center and press: the imprint
      await moveGlass(CX, CY, 700, 'cubic-bezier(0.65, 0, 0.35, 1)');
      await wait(150);
      if (cancelled || doneRef.current) return;
      const press = track(
        glassGroup.animate(
          [
            { transform: `translate(${CX}px, ${CY}px) scale(1)` },
            { transform: `translate(${CX}px, ${CY}px) scale(0.86)`, offset: 0.4 },
            { transform: `translate(${CX}px, ${CY}px) scale(1)` },
          ],
          { duration: 420, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }
        )
      );
      ripple(160, 90, 900, 2.5, 0.9);
      ripple(280, 170, 1100, 1.5, 0.6);
      ripple(400, 260, 1300, 1, 0.35);
      await press.finished;
      if (cancelled || doneRef.current) return;

      // 3. the web spreads from the imprint; the glass retires
      revealWeb();
      track(
        glassGroup.animate(
          [
            { opacity: 1, transform: `translate(${CX}px, ${CY}px) scale(1)` },
            { opacity: 0, transform: `translate(${CX}px, ${CY}px) scale(1.35)` },
          ],
          { duration: 800, delay: 300, easing: 'ease-out', fill: 'forwards' }
        )
      );

      // 4. dim the web slightly, reveal the name
      await wait(1900);
      if (cancelled || doneRef.current) return;
      track(
        webGroup.animate([{ opacity: 1 }, { opacity: 0.35 }], {
          duration: 900,
          easing: 'ease-out',
          fill: 'forwards',
        })
      );
      setTitleVisible(true);

      // 5. title visible ~1.2s, then fade the overlay out and complete
      await wait(1200);
      if (!cancelled) finish(500);
    }

    run().catch(() => {
      // Animation.finished rejects if cancelled during cleanup — safe to ignore
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      timeouts.forEach((t) => window.clearTimeout(t));
      timeouts.length = 0;
      animations.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* already finished */
        }
      });
      animations.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={skip}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'radial-gradient(120% 120% at 50% 42%, var(--paper2) 0%, var(--paper) 62%, var(--paper) 100%)',
        opacity: fading ? 0 : 1,
        transitionProperty: 'opacity',
        transitionDuration: '500ms',
        transitionTimingFunction: 'ease',
      }}
    >
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
        <svg ref={sceneRef} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
      </div>

      {/* Title block */}
      <div
        className={titleVisible ? 'intro-title show' : 'intro-title'}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <div
          className="text-ink-mid"
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(1rem, 2.2vw, 1.4rem)',
            letterSpacing: '0.55em',
            marginLeft: '0.55em' /* optical: balance the tracking */,
            color: 'var(--ink-mid)',
          }}
        >
          見つけた
        </div>
        <h1
          style={{
            margin: '0.35rem 0 0',
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(2.6rem, 8vw, 5.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            color: 'var(--accent)',
          }}
        >
          MITSUKETA
        </h1>
        <div
          style={{
            marginTop: '1rem',
            fontSize: 12,
            letterSpacing: '0.32em',
            marginLeft: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--ink-pale)',
          }}
        >
          Corporate structure, found
        </div>
      </div>

      {/* Skip button — discoverability; click-anywhere also skips */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        aria-label="Skip intro animation"
        className="intro-skip"
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink-pale)',
          font: 'inherit',
          fontSize: 12,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          padding: '8px 16px',
          transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ink)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ink-pale)';
        }}
      >
        Skip
      </button>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .intro-glass-inner { animation: intro-bob 2.6s ease-in-out infinite; }
          @keyframes intro-bob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          .intro-title.show {
            animation: intro-title-in 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          @keyframes intro-title-in {
            from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .intro-title.show { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default IntroAnimation;
