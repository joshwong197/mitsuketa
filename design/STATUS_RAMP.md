# Status ramp + roadmap (agreed 2026-07-11)

All work on localhost until pushed as a branch. Tokens from `design/SUMI_SPEC.md` §1.

## Node/edge status treatment

Sumi logic: active = plain ink, trouble = dyed, dead = faded.

| Status | Treatment |
|---|---|
| Registered / active | Default node: `--ink` on `--paper`, no status color |
| Liquidation / receivership / voluntary admin | `--amber` border + status chip |
| Struck off / removed | Faded: `--ink-pale` text, `--ink-wash` border, no bright color |
| Insolvency / disqualified director | `--crit` border + chip — the ONLY red on canvas |
| Amalgamated | Faded like struck-off + → glyph to successor if on-graph |
| Edge: current role | solid `--ink-mid` |
| Edge: ceased role | dashed `--ink-wash` |

Small ink-style legend chip on the canvas.

## Animations (all behind prefers-reduced-motion)

- Edges draw in on graph build (stroke-dashoffset, brush-stroke feel)
- Crit nodes only: slow ~3s ink-bleed border pulse (amber stays static)
- Status chips fade-up on first render

## Agreed roadmap (order)

1. Status ramp + animations (above)
2. Re-dye `export-viewer.css` / hosted viewer to sumi tokens
3. FindScreen recent searches / pinned entities (localStorage)
4. Ctrl+K command palette (tab jump, recent search, theme toggle)
5. Compare tool: FindScreen A↔B slot, BFS via existing graph service,
   render connecting path(s) only, rest at low opacity. Supports
   entity↔entity, person↔person, person↔entity.
6. Node annotations: right-click → note, `{nodeId, text, flag}` in
   localStorage per tab, dog-ear mark on noted nodes, notes included
   in export. Pairs with compare tool.
