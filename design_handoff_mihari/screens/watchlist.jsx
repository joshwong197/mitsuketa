/* Mihari — Watchlist (名簿 · the roster)
 *
 * An editorial ledger of the 42 entities being watched.
 * Layout: single column, full-width table. Filters + search sit above.
 * Rows expand inline (no modal) to reveal last 3 alerts + profile.
 * Bulk select bar slides in when ≥1 row is checked.
 */

const WL_DEMO = [
  { id: "e1",  name: "Kōwhai Logistics Ltd",         nzbn: "9429044031210", status: "In Liquidation", statusSev: "red",   industry: "Road freight · Auckland", list: "loan_portfolio", addedOn: "2024-11-03", lastEvent: "2h ago",   lastEventRaw: new Date("2026-01-13T07:12:00+13:00"), tallies: { red: 2, amber: 1, green: 0 }, unread: true,  muted: false, spark: [0,1,0,0,2,1,3], recent: [
      { sev: "red",   t: "2h",  title: "Liquidator appointed",        type: "Company insolvency · 13" },
      { sev: "red",   t: "3h",  title: "Gazette — winding up notice", type: "Gazette notice · 79" },
      { sev: "amber", t: "9d",  title: "Service address changed",     type: "Address change · 12" },
  ]},
  { id: "e2",  name: "Parnell Craft Coffee Ltd",     nzbn: "9429050138844", status: "Registered",     statusSev: "amber", industry: "Hospitality · Parnell", list: "trade_credit", addedOn: "2025-02-14", lastEvent: "7h ago",   lastEventRaw: new Date("2026-01-13T02:15:00+13:00"), tallies: { red: 1, amber: 0, green: 1 }, unread: true,  muted: false, spark: [0,0,0,0,1,0,2], recent: [
      { sev: "red",   t: "7h", title: "Statutory demand — s289", type: "Gazette notice · 71" },
      { sev: "green", t: "4d", title: "Annual return filed",     type: "Filing & compliance · 20" },
  ]},
  { id: "e3",  name: "Harbourline Freight Ltd",      nzbn: "9429031180944", status: "Registered",     statusSev: "green", industry: "Sea freight · Mt Maunganui", list: "loan_portfolio", addedOn: "2024-08-21", lastEvent: "3h ago",   lastEventRaw: new Date("2026-01-13T06:48:00+13:00"), tallies: { red: 0, amber: 2, green: 1 }, unread: true,  muted: false, spark: [1,0,2,1,0,1,1], recent: [
      { sev: "amber", t: "3h",  title: "Director resigned",        type: "Director change · 26" },
      { sev: "amber", t: "19h", title: "Service address changed",  type: "Address change · 12" },
      { sev: "green", t: "5d",  title: "Annual return filed",      type: "Filing & compliance · 20" },
  ]},
  { id: "e4",  name: "Mānuka & Sons Builders Ltd",   nzbn: "9429041755028", status: "Registered",     statusSev: "amber", industry: "Residential construction · South Auckland", list: "trade_credit", addedOn: "2025-05-09", lastEvent: "5h ago",   lastEventRaw: new Date("2026-01-13T04:22:00+13:00"), tallies: { red: 0, amber: 1, green: 0 }, unread: false, muted: false, spark: [0,0,0,0,0,0,1], recent: [
      { sev: "amber", t: "5h", title: "Registered office changed", type: "Address change · 5" },
  ]},
  { id: "e5",  name: "Southside Plant Hire Ltd",     nzbn: "9429030094415", status: "Registered",     statusSev: "amber", industry: "Equipment hire · Papakura", list: "watch_closely", addedOn: "2025-11-26", lastEvent: "9h ago",   lastEventRaw: new Date("2026-01-13T00:10:00+13:00"), tallies: { red: 0, amber: 1, green: 0 }, unread: true,  muted: false, spark: [0,0,0,0,0,0,1], recent: [
      { sev: "amber", t: "9h", title: "Director linked to distressed company", type: "Cross-entity risk · 65" },
  ]},
  { id: "e6",  name: "Tāwhiri Analytics Ltd",        nzbn: "9429048822115", status: "Registered",     statusSev: "green", industry: "Data services · Wellington", list: "trade_credit", addedOn: "2025-09-02", lastEvent: "4h ago",   lastEventRaw: new Date("2026-01-13T05:30:00+13:00"), tallies: { red: 0, amber: 0, green: 1 }, unread: false, muted: false, spark: [0,0,0,0,0,0,1], recent: [
      { sev: "green", t: "4h", title: "Annual return filed", type: "Filing & compliance · 20" },
  ]},
  { id: "e7",  name: "Ōtākou Seafoods Ltd",          nzbn: "9429039118477", status: "Registered",     statusSev: "green", industry: "Seafood processing · Dunedin", list: "loan_portfolio", addedOn: "2024-06-18", lastEvent: "2d ago",   lastEventRaw: new Date("2026-01-11T11:00:00+13:00"), tallies: { red: 0, amber: 0, green: 0 }, unread: false, muted: false, spark: [0,0,0,0,0,0,0], recent: [] },
  { id: "e8",  name: "Rangitoto Scaffolding Ltd",    nzbn: "9429046701228", status: "Registered",     statusSev: "amber", industry: "Construction services · Auckland", list: "trade_credit", addedOn: "2025-03-12", lastEvent: "1d ago",   lastEventRaw: new Date("2026-01-12T09:10:00+13:00"), tallies: { red: 0, amber: 1, green: 1 }, unread: false, muted: false, spark: [0,0,0,1,0,1,0], recent: [
      { sev: "amber", t: "1d", title: "Shareholding restructure", type: "Shareholder change · 41" },
      { sev: "green", t: "3d", title: "Annual return filed",      type: "Filing & compliance · 20" },
  ]},
  { id: "e9",  name: "Kapiti Joinery Co Ltd",        nzbn: "9429035509917", status: "Registered",     statusSev: "green", industry: "Cabinetmaking · Paraparaumu", list: "trade_credit", addedOn: "2025-07-30", lastEvent: "6d ago",   lastEventRaw: new Date("2026-01-07T14:00:00+13:00"), tallies: { red: 0, amber: 0, green: 1 }, unread: false, muted: true,  spark: [0,0,0,0,0,0,0], recent: [
      { sev: "green", t: "6d", title: "GST registration updated", type: "Business profile · 55" },
  ]},
  { id: "e10", name: "South Central Build Group Ltd",nzbn: "9429041880221", status: "In Liquidation", statusSev: "red",   industry: "Commercial construction · Christchurch", list: "loan_portfolio", addedOn: "2024-04-02", lastEvent: "2d ago",   lastEventRaw: new Date("2026-01-11T09:05:00+13:00"), tallies: { red: 3, amber: 1, green: 0 }, unread: false, muted: false, spark: [0,0,1,0,2,1,0], recent: [
      { sev: "red",   t: "2d", title: "Court-ordered liquidation",   type: "Company insolvency · 14" },
      { sev: "red",   t: "2d", title: "Gazette — liquidator filed",  type: "Gazette notice · 79" },
      { sev: "amber", t: "5d", title: "Director resigned",           type: "Director change · 26" },
  ]},
  { id: "e11", name: "Waitematā Timber Supplies Ltd",nzbn: "9429029744801", status: "Registered",     statusSev: "green", industry: "Building supplies · Albany", list: "trade_credit", addedOn: "2025-01-08", lastEvent: "11d ago",  lastEventRaw: new Date("2026-01-02T08:00:00+13:00"), tallies: { red: 0, amber: 0, green: 0 }, unread: false, muted: false, spark: [0,0,0,0,0,0,0], recent: [] },
  { id: "e12", name: "Te Awamutu Transport Ltd",     nzbn: "9429037226553", status: "Registered",     statusSev: "amber", industry: "Road freight · Waikato", list: "loan_portfolio", addedOn: "2024-10-11", lastEvent: "8h ago",   lastEventRaw: new Date("2026-01-13T01:00:00+13:00"), tallies: { red: 0, amber: 2, green: 0 }, unread: true,  muted: false, spark: [0,1,0,0,0,1,0], recent: [
      { sev: "amber", t: "8h", title: "Shareholding restructure",  type: "Shareholder change · 41" },
      { sev: "amber", t: "3d", title: "Trading name added",        type: "Name change · 30" },
  ]},
  { id: "e13", name: "Kiwifruit Growers Co-op Ltd",  nzbn: "9429028118011", status: "Registered",     statusSev: "green", industry: "Horticulture · Bay of Plenty", list: "trade_credit", addedOn: "2024-12-20", lastEvent: "14d ago",  lastEventRaw: new Date("2025-12-30T10:00:00+13:00"), tallies: { red: 0, amber: 0, green: 0 }, unread: false, muted: true,  spark: [0,0,0,0,0,0,0], recent: [] },
  { id: "e14", name: "Ngāti Porou Developments Ltd",  nzbn: "9429045711003", status: "Registered",     statusSev: "green", industry: "Property development · Gisborne", list: "watch_closely", addedOn: "2025-06-03", lastEvent: "4d ago",   lastEventRaw: new Date("2026-01-09T12:00:00+13:00"), tallies: { red: 0, amber: 0, green: 1 }, unread: false, muted: false, spark: [0,0,0,0,0,1,0], recent: [
      { sev: "green", t: "4d", title: "Particulars updated", type: "Business profile · 55" },
  ]},
];

const LISTS = [
  { id: "all",           label: "All entities",  jp: "全部", count: 42 },
  { id: "watch_closely", label: "Watch closely", jp: "注視", count: 6  },
  { id: "muted",         label: "Muted",         jp: "静",   count: 3  },
];

/* Default recipients (mirrors Preferences). In real app these come from user prefs. */
const DEFAULT_RECIPIENTS = ["josh@mihari.nz", "ap@mihari.nz", "credit@mihari.nz"];

/* Per-entity recipient overrides. Absent = uses defaults. */
const RECIP_OVERRIDES = {
  e1:  { add: ["legal@mihari.nz", "liquidations@mihari.nz"], remove: [] },                // Kōwhai — escalated
  e2:  { add: ["ap@mihari.nz"],                               remove: ["credit@mihari.nz"] }, // Parnell — trade only
  e10: { add: ["legal@mihari.nz", "receiver@mihari.nz"],     remove: [] },                // South Central — escalated
};

const Sparkline = ({ data, C, color }) => {
  const max = Math.max(1, ...data);
  const w = 72, h = 20, bw = w / data.length;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {data.map((v, i) => {
        const bh = (v / max) * h;
        return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh || 1}
          fill={v === 0 ? C.inkFaint : (color || C.ai)} opacity={v === 0 ? 0.35 : 1} />;
      })}
    </svg>
  );
};

const TallyBar = ({ t, C }) => {
  const total = t.red + t.amber + t.green;
  if (total === 0) {
    return <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500 }}>— no activity</span>;
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {t.red > 0   && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 18, height: 18, background: C.vermillion, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mincho, fontSize: 11, fontWeight: 700, color: C.bg }}>紅</div><span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ink, fontWeight: 600 }}>{t.red}</span></div>}
      {t.amber > 0 && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 18, height: 18, background: C.amber,     display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mincho, fontSize: 11, fontWeight: 700, color: C.bg }}>琥</div><span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ink, fontWeight: 600 }}>{t.amber}</span></div>}
      {t.green > 0 && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 18, height: 18, background: C.green,     display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mincho, fontSize: 11, fontWeight: 700, color: C.bg }}>青</div><span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ink, fontWeight: 600 }}>{t.green}</span></div>}
    </div>
  );
};

const Watchlist = ({ theme }) => {
  const { C } = theme;
  const [list, setList] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("event"); // event | severity | alpha
  const [selected, setSelected] = React.useState(new Set());
  const [expanded, setExpanded] = React.useState(new Set(["e1"]));
  const [addOpen, setAddOpen] = React.useState(false);

  const sevRank = { red: 3, amber: 2, green: 1 };
  const visible = React.useMemo(() => {
    let rows = WL_DEMO.slice();
    if (list === "muted") rows = rows.filter(r => r.muted);
    else if (list !== "all") rows = rows.filter(r => r.list === list && !r.muted);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.nzbn.includes(q) || r.industry.toLowerCase().includes(q));
    }
    if (sort === "event") rows.sort((a,b) => b.lastEventRaw - a.lastEventRaw);
    if (sort === "severity") rows.sort((a,b) => (sevRank[b.statusSev] - sevRank[a.statusSev]) || (b.tallies.red*3 + b.tallies.amber - (a.tallies.red*3 + a.tallies.amber)));
    if (sort === "alpha") rows.sort((a,b) => a.name.localeCompare(b.name));
    return rows;
  }, [list, query, sort]);

  const toggleSel = (id) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map(r => r.id)));
  };
  const toggleExp = (id) => {
    const n = new Set(expanded); n.has(id) ? n.delete(id) : n.add(id); setExpanded(n);
  };

  // Responsive: wide ≥1280 shows the full 8-col ledger; compact <1280 switches to card rows.
  const [wide, setWide] = React.useState(typeof window !== "undefined" ? window.innerWidth >= 1280 : true);
  React.useEffect(() => {
    const onR = () => setWide(window.innerWidth >= 1280);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const cols = "42px 42px minmax(0,2.4fr) minmax(0,1fr) 170px 130px 100px 60px";

  return (
    <main style={{ padding: "clamp(28px, 4vw, 48px) clamp(20px, 4vw, 56px) 80px", color: C.ink, fontFamily: FONTS.serif }}>

      {/* ── Masthead ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 34 }}>
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <Label num="iii." jp="名簿" C={C}>Watchlist</Label>
          <h1 style={{
            fontFamily: FONTS.serif, fontSize: "clamp(40px, 5.4vw, 68px)", fontWeight: 300, lineHeight: 1.04,
            letterSpacing: "-0.03em", margin: "14px 0 0", color: C.ink, textWrap: "pretty",
          }}>
            The roster.
            <em style={{ fontWeight: 300, color: C.inkDim }}> {WL_DEMO.length} entities under watch.</em>
          </h1>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, marginTop: 14, display: "flex", gap: 22, flexWrap: "wrap" }}>
            <span>Last sweep · 06:04 NZST</span>
            <span style={{ color: C.inkFaint }}>│</span>
            <span>{WL_DEMO.filter(r => r.unread).length} with unread events</span>
            <span style={{ color: C.inkFaint }}>│</span>
            <span>{WL_DEMO.filter(r => r.muted).length} muted</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button style={{
            background: "none", border: `1px solid ${C.rule}`, color: C.ink,
            fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "11px 18px", cursor: "pointer",
          }}>Export CSV</button>
          <button onClick={() => setAddOpen(true)} style={{
            background: C.ink, border: `1px solid ${C.ink}`, color: C.bg,
            fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "11px 22px", cursor: "pointer",
          }}>＋ Add entity</button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: wide ? "minmax(0,1fr) auto auto" : "minmax(0,1fr)",
        gap: 0,
        border: `1px solid ${C.rule}`, marginBottom: 0,
      }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
          <span style={{ fontFamily: FONTS.gothic, fontSize: 14, color: C.inkDim, fontWeight: 500 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entity name, NZBN, industry…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: FONTS.serif, fontSize: 16, color: C.ink,
            }}
          />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 12 }}>clear ✕</button>}
        </div>
        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", borderLeft: wide ? `1px solid ${C.rule}` : "none", borderTop: wide ? "none" : `1px solid ${C.rule}` }}>
          {[
            { id: "event",    label: "Last event" },
            { id: "severity", label: "Severity" },
            { id: "alpha",    label: "A–Z" },
          ].map((s, i) => (
            <button key={s.id} onClick={() => setSort(s.id)} style={{
              background: sort === s.id ? C.panel : "transparent",
              border: "none",
              borderLeft: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
              color: sort === s.id ? C.ink : C.inkDim,
              fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
              padding: "14px 18px", cursor: "pointer",
            }}>{s.label}</button>
          ))}
        </div>
        {/* Density dummy */}
        <div style={{ borderLeft: wide ? `1px solid ${C.rule}` : "none", borderTop: wide ? "none" : `1px solid ${C.ruleSoft}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500 }}>
          <span>{visible.length} of {WL_DEMO.length}</span>
        </div>
      </div>

      {/* ── List chips row ──────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: wide ? "nowrap" : "wrap", borderLeft: `1px solid ${C.rule}`, borderRight: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }}>
        {LISTS.map((l, i) => (
          <button key={l.id} onClick={() => setList(l.id)} style={{
            flex: wide ? 1 : "1 1 140px",
            background: list === l.id ? C.bg : C.panel,
            border: "none",
            borderLeft: (wide && i > 0) ? `1px solid ${C.rule}` : (!wide && (i % 2 === 1) ? `1px solid ${C.rule}` : "none"),
            borderTop: list === l.id ? `2px solid ${C.vermillion}` : `2px solid transparent`,
            marginTop: list === l.id ? -1 : 0,
            padding: "16px 18px", cursor: "pointer", textAlign: "left",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color: list === l.id ? C.vermillion : C.inkDim, letterSpacing: "0.2em", fontWeight: 500 }}>{l.jp}</span>
              <span style={{ fontFamily: FONTS.serif, fontSize: 18, color: list === l.id ? C.ink : C.inkDim, letterSpacing: "-0.01em" }}>{l.label}</span>
            </div>
            <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>{l.count} entities</span>
          </button>
        ))}
      </div>

      {/* ── Bulk action bar (appears with selection) ────── */}
      {selected.size > 0 && (
        <div style={{
          background: C.ink, color: C.bg,
          padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
          borderLeft: `1px solid ${C.ink}`, borderRight: `1px solid ${C.ink}`,
        }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.bg }}>
            {selected.size} selected
          </span>
          <span style={{ flex: "1 0 20px" }} />
          <button style={{ background: "none", border: `1px solid ${C.inkDim}`, color: C.bg, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "8px 12px", cursor: "pointer" }}>Mute 7 days</button>
          <button style={{ background: "none", border: `1px solid ${C.inkDim}`, color: C.bg, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "8px 12px", cursor: "pointer" }}>Move to list…</button>
          <button style={{ background: "none", border: `1px solid ${C.inkDim}`, color: C.bg, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "8px 12px", cursor: "pointer" }}>Mark read</button>
          <button style={{ background: "none", border: `1px solid ${C.vermillion}`, color: C.vermillion, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "8px 12px", cursor: "pointer" }}>Remove</button>
          <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────── */}
      <div style={{ border: `1px solid ${C.rule}`, borderTop: "none", background: C.bg }}>
        {/* Head (wide only) */}
        {wide && (
          <div style={{
            display: "grid", gridTemplateColumns: cols,
            borderBottom: `1px solid ${C.rule}`,
            fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            <div style={{ padding: "14px 0 14px 20px", display: "flex", alignItems: "center" }}>
              <Checkbox checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} C={C} />
            </div>
            <div style={{ padding: "14px 0" }}></div>
            <div style={{ padding: "14px 0" }}>Entity</div>
            <div style={{ padding: "14px 0" }}>Status · industry</div>
            <div style={{ padding: "14px 0" }}>Alerts · last 7 days</div>
            <div style={{ padding: "14px 0" }}>Last event</div>
            <div style={{ padding: "14px 0" }}>Activity</div>
            <div style={{ padding: "14px 0 14px" }}></div>
          </div>
        )}
        {!wide && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 18px", borderBottom: `1px solid ${C.rule}`,
            fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            <Checkbox checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} C={C} />
            <span>Select all</span>
            <span style={{ flex: 1 }} />
            <span style={{ textTransform: "none", letterSpacing: 0, color: C.inkFaint }}>{visible.length} shown</span>
          </div>
        )}

        {/* Rows */}
        {visible.map((r, i) => {
          const isExp = expanded.has(r.id);
          const isSel = selected.has(r.id);
          const counter = String(i + 1).padStart(2, "0");
          return (
            <React.Fragment key={r.id}>
              {wide ? (
                // ── WIDE: 8-column ledger row ───────────────
                <div style={{
                  display: "grid", gridTemplateColumns: cols, alignItems: "center",
                  borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
                  background: isSel ? C.panel2 : (r.muted ? C.panel : "transparent"),
                  opacity: r.muted ? 0.6 : 1,
                  cursor: "pointer",
                  transition: "background 120ms",
                }} onClick={() => toggleExp(r.id)}>
                  {/* Checkbox */}
                  <div style={{ padding: "22px 0 22px 20px" }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSel} onChange={() => toggleSel(r.id)} C={C} />
                  </div>
                  {/* Counter */}
                  <div style={{ padding: "22px 0", fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500 }}>{counter}</div>
                  {/* Name */}
                  <div style={{ padding: "22px 16px 22px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {r.unread && <div style={{ width: 7, height: 7, background: C.vermillion, flexShrink: 0 }} />}
                      <div style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{r.name}</div>
                      {r.muted && <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 500, border: `1px solid ${C.rule}`, padding: "2px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>muted</span>}
                    </div>
                    <div style={{ fontFamily: FONTS.mincho, fontSize: 12, color: C.inkDim, marginTop: 4, letterSpacing: "0.08em" }}>NZBN · {r.nzbn}</div>
                  </div>
                  {/* Status + industry */}
                  <div style={{ padding: "22px 16px 22px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <SevKanji sev={r.statusSev} size={18} C={C} />
                      <span style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink }}>{r.status}</span>
                    </div>
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>{r.industry}</div>
                  </div>
                  {/* Tallies */}
                  <div style={{ padding: "22px 16px 22px 0" }}>
                    <TallyBar t={r.tallies} C={C} />
                  </div>
                  {/* Last event */}
                  <div style={{ padding: "22px 16px 22px 0", fontFamily: FONTS.gothic, fontSize: 13, color: C.ai, fontWeight: 500 }}>
                    {r.lastEvent}
                  </div>
                  {/* Spark */}
                  <div style={{ padding: "22px 12px 22px 0" }}>
                    <Sparkline data={r.spark} C={C} color={r.tallies.red > 0 ? C.vermillion : (r.tallies.amber > 0 ? C.amber : C.ai)} />
                  </div>
                  {/* Chevron */}
                  <div style={{ padding: "22px 20px 22px 0", textAlign: "right", fontFamily: FONTS.gothic, fontSize: 14, color: C.inkDim, fontWeight: 500 }}>
                    {isExp ? "−" : "+"}
                  </div>
                </div>
              ) : (
                // ── COMPACT: stacked card row ────────────────
                <div style={{
                  borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
                  background: isSel ? C.panel2 : (r.muted ? C.panel : "transparent"),
                  opacity: r.muted ? 0.6 : 1,
                  cursor: "pointer", padding: "18px 18px 16px",
                }} onClick={() => toggleExp(r.id)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ paddingTop: 2 }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSel} onChange={() => toggleSel(r.id)} C={C} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Top line: unread + name + muted + chevron */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        {r.unread && <div style={{ width: 7, height: 7, background: C.vermillion, flexShrink: 0, marginTop: 11 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1.2, textWrap: "balance" }}>{r.name}</div>
                          <div style={{ fontFamily: FONTS.mincho, fontSize: 12, color: C.inkDim, marginTop: 4, letterSpacing: "0.08em" }}>NZBN · {r.nzbn}</div>
                        </div>
                        {r.muted && <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 500, border: `1px solid ${C.rule}`, padding: "2px 6px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>muted</span>}
                        <div style={{ fontFamily: FONTS.gothic, fontSize: 16, color: C.inkDim, fontWeight: 500, flexShrink: 0, marginLeft: 4 }}>{isExp ? "−" : "+"}</div>
                      </div>
                      {/* Status line */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <SevKanji sev={r.statusSev} size={18} C={C} />
                        <span style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink }}>{r.status}</span>
                        <span style={{ color: C.inkFaint, fontFamily: FONTS.gothic, fontSize: 11 }}>│</span>
                        <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>{r.industry}</span>
                      </div>
                      {/* Meta line: tallies + last event */}
                      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
                        <TallyBar t={r.tallies} C={C} />
                        <span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ai, fontWeight: 500 }}>
                          ↳ {r.lastEvent}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded row */}
              {isExp && (
                <div style={{
                  background: C.panel,
                  borderTop: `1px solid ${C.rule}`,
                  borderBottom: `1px solid ${C.rule}`,
                }}>
                  {/* Recipients strip — spans full width, above the two-column detail area */}
                  <RecipientsStrip entityId={r.id} C={C} wide={wide} />

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: wide ? "84px minmax(0,1fr) 320px" : "minmax(0,1fr)",
                    borderTop: `1px solid ${C.ruleSoft}`,
                  }}>
                  {/* Gutter (aligns with counter col) — wide only */}
                  {wide && <div></div>}
                  {/* Recent alerts */}
                  <div style={{ padding: wide ? "28px 24px 32px 0" : "24px 20px 8px" }}>
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>
                      Recent events
                    </div>
                    {r.recent.length === 0 ? (
                      <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, fontStyle: "italic" }}>
                        No events recorded since this entity was added {new Date(r.addedOn).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" })}. A quiet ledger.
                      </div>
                    ) : (
                      <div>
                        {r.recent.map((a, j) => (
                          <div key={j} style={{
                            display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 80px",
                            gap: 16, alignItems: "start",
                            padding: "14px 0",
                            borderTop: j > 0 ? `1px solid ${C.ruleSoft}` : "none",
                          }}>
                            <SevKanji sev={a.sev} size={24} C={C} />
                            <div>
                              <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.ink, letterSpacing: "-0.005em", lineHeight: 1.3 }}>{a.title}</div>
                              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>{a.type}</div>
                            </div>
                            <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ai, fontWeight: 500, textAlign: "right" }}>{a.t} ago</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Side panel: actions + meta */}
                  <div style={{ padding: wide ? "28px 28px 32px 24px" : "20px 20px 28px", borderLeft: wide ? `1px solid ${C.rule}` : "none", borderTop: wide ? "none" : `1px solid ${C.ruleSoft}` }}>
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>
                      Details
                    </div>
                    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500 }}>
                      <dt style={{ color: C.inkDim }}>List</dt>
                      <dd style={{ margin: 0, color: C.ink }}>{LISTS.find(l => l.id === r.list)?.label || "—"}</dd>
                      <dt style={{ color: C.inkDim }}>Added</dt>
                      <dd style={{ margin: 0, color: C.ink }}>{new Date(r.addedOn).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" })}</dd>
                      <dt style={{ color: C.inkDim }}>NZBN</dt>
                      <dd style={{ margin: 0, color: C.ink, fontFamily: FONTS.mincho }}>{r.nzbn}</dd>
                      <dt style={{ color: C.inkDim }}>Sweep</dt>
                      <dd style={{ margin: 0, color: C.green }}>● daily</dd>
                    </dl>
                    <div style={{ display: "grid", gap: 8, marginTop: 22 }}>
                      <button style={{ background: C.ink, color: C.bg, border: `1px solid ${C.ink}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "10px 16px", cursor: "pointer", textAlign: "left" }}>
                        Open entity detail →
                      </button>
                      <button style={{ background: "none", color: C.ink, border: `1px solid ${C.rule}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "10px 16px", cursor: "pointer", textAlign: "left" }}>
                        See all {r.tallies.red + r.tallies.amber + r.tallies.green || "events"} alerts
                      </button>
                      <button style={{ background: "none", color: C.inkDim, border: `1px solid ${C.rule}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "10px 16px", cursor: "pointer", textAlign: "left" }}>
                        {r.muted ? "Unmute" : "Mute for 7 days"}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {visible.length === 0 && (
          <div style={{ padding: "80px 20px", textAlign: "center", fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 18, color: C.inkDim }}>
            No entities match. Try another list or clear your search.
          </div>
        )}
      </div>

      {/* ── Footer rule ─────────────────────────────────── */}
      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>
        <span>{visible.length} shown · {WL_DEMO.length} total on plan</span>
        <span>Roster capacity · 50 / plan tier · Ledger</span>
      </div>

      {/* ── Add entity drawer ───────────────────────────── */}
      {addOpen && <AddEntitySheet C={C} onClose={() => setAddOpen(false)} />}
    </main>
  );
};

/* Recipients strip — shows who gets alerts for this entity, with override awareness. */
const RecipientsStrip = ({ entityId, C, wide }) => {
  const override = RECIP_OVERRIDES[entityId];
  const [editing, setEditing] = React.useState(false);
  const [draftAdd, setDraftAdd] = React.useState("");

  const computed = React.useMemo(() => {
    const base = new Set(DEFAULT_RECIPIENTS);
    if (override) {
      override.remove.forEach(e => base.delete(e));
      override.add.forEach(e => base.add(e));
    }
    return [...base];
  }, [entityId]);

  const isOverridden = !!override && (override.add.length > 0 || override.remove.length > 0);

  return (
    <div style={{
      padding: wide ? "18px 28px 18px 108px" : "16px 20px",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      borderLeft: isOverridden ? `3px solid ${C.vermillion}` : "none",
      paddingLeft: wide ? (isOverridden ? 105 : 108) : (isOverridden ? 17 : 20),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color: C.inkDim, letterSpacing: "0.2em" }}>宛先</span>
        <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Recipients
        </span>
        {isOverridden ? (
          <span style={{ fontFamily: FONTS.gothic, fontSize: 10, fontWeight: 600, color: C.vermillion, border: `1px solid ${C.vermillion}`, padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            overrides default
          </span>
        ) : (
          <span style={{ fontFamily: FONTS.gothic, fontSize: 10, fontWeight: 500, color: C.inkFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            using default
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        {computed.map(email => {
          const isAdded = override?.add.includes(email);
          return (
            <span key={email} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px",
              background: isAdded ? C.bg : "transparent",
              border: `1px solid ${isAdded ? C.vermillion : C.rule}`,
              fontFamily: FONTS.gothic, fontSize: 12, color: C.ink, fontWeight: 500,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: isAdded ? C.vermillion : C.green }} />
              {email}
              {isAdded && editing && <button onClick={(e)=>{e.stopPropagation();}} style={{ background: "none", border: "none", color: C.inkFaint, cursor: "pointer", padding: 0, marginLeft: 2, fontSize: 14, lineHeight: 1 }}>×</button>}
            </span>
          );
        })}
        {override?.remove.map(email => (
          <span key={email} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 10px",
            border: `1px dashed ${C.rule}`,
            fontFamily: FONTS.gothic, fontSize: 12, color: C.inkFaint, fontWeight: 500,
            textDecoration: "line-through",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.inkFaint }} />
            {email}
          </span>
        ))}
        {editing && (
          <input
            autoFocus
            value={draftAdd}
            onChange={(e) => setDraftAdd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setDraftAdd(""); } }}
            onClick={(e) => e.stopPropagation()}
            placeholder="+ add email…"
            style={{
              padding: "5px 10px",
              background: "transparent",
              border: `1px dashed ${C.vermillion}`,
              fontFamily: FONTS.gothic, fontSize: 12, color: C.ink, fontWeight: 500,
              outline: "none", minWidth: 160,
            }}
          />
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setEditing(v => !v); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: C.ai, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}
      >
        {editing ? "Done" : (isOverridden ? "Edit overrides →" : "Override defaults →")}
      </button>
      {isOverridden && !editing && (
        <button
          onClick={(e) => e.stopPropagation()}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500 }}
        >
          Reset to default
        </button>
      )}
    </div>
  );
};

const Checkbox = ({ checked, onChange, C }) => (
  <div onClick={onChange} style={{
    width: 16, height: 16, border: `1px solid ${checked ? C.vermillion : C.rule}`,
    background: checked ? C.vermillion : "transparent",
    cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    {checked && <div style={{ width: 8, height: 8, background: C.bg }} />}
  </div>
);

const AddEntitySheet = ({ C, onClose }) => {
  const [q, setQ] = React.useState("");
  const results = q.length > 1 ? [
    { name: "Kāinga Ora Kitchens Ltd",      nzbn: "9429047112445", status: "Registered",     statusSev: "green", industry: "Cabinetmaking · Hamilton" },
    { name: "Karapiro Orchards Ltd",        nzbn: "9429042001876", status: "Registered",     statusSev: "green", industry: "Horticulture · Waikato" },
    { name: "Kaitaia Civil Contractors Ltd",nzbn: "9429038771104", status: "In Liquidation", statusSev: "red",   industry: "Civil construction · Far North" },
  ] : [];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 520, maxWidth: "100vw", height: "100vh", background: C.bg,
        borderLeft: `1px solid ${C.rule}`, display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "28px 32px", borderBottom: `1px solid ${C.rule}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Label num="＋" jp="追加" C={C}>Add entity to watchlist</Label>
            <h2 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", margin: "12px 0 0", color: C.ink }}>
              Search the NZBN register.
            </h2>
            <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, margin: "10px 0 0", lineHeight: 1.6 }}>
              We watch up to 50 entities on the Ledger plan. You are at 42 of 50.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "24px 32px", borderBottom: `1px solid ${C.rule}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${C.rule}`, padding: "14px 18px", background: C.panel }}>
            <span style={{ fontFamily: FONTS.gothic, fontSize: 14, color: C.inkDim }}>⌕</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or NZBN · e.g. 9429044031210"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: FONTS.serif, fontSize: 16, color: C.ink }}
            />
          </div>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 12 }}>
            Queries hit the live NZBN index. A first sweep runs within 15 minutes of adding.
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: results.length ? "12px 0" : "32px" }}>
          {results.length === 0 ? (
            <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 17, color: C.inkDim, textAlign: "center", padding: "60px 20px" }}>
              {q.length <= 1 ? "Type to search the NZBN register." : "No matches. Try the full NZBN."}
            </div>
          ) : (
            results.map((r, i) => (
              <div key={i} style={{
                padding: "20px 32px", borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
                display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: 16, alignItems: "center",
                cursor: "pointer",
              }}>
                <SevKanji sev={r.statusSev} size={22} C={C} />
                <div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em" }}>{r.name}</div>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>NZBN {r.nzbn} · {r.status} · {r.industry}</div>
                </div>
                <button style={{ background: C.ink, color: C.bg, border: `1px solid ${C.ink}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "9px 14px", cursor: "pointer" }}>
                  ＋ Add
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "20px 32px", borderTop: `1px solid ${C.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>
          <span>Or paste a CSV of NZBNs on the Upload page.</span>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.rule}`, color: C.ink, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "10px 18px", cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
};

window.Watchlist = Watchlist;
