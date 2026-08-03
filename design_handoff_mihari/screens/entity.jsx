/* Mihari — Entity detail (会社 · Kōwhai Logistics Ltd)
 *
 * Read-only ledger for one watched entity. No natural-person names.
 * Layout: left TOC rail (≥1280) + main editorial column.
 *   1. Masthead — name, NZBN, status kanji, actions
 *   2. Particulars strip — industry / registered / on watch / last sweep
 *   3. Timeline — reverse-chronological; severity kanji + diff + ai note
 *   4. Directors / Shareholders / Addresses / Filings — current state
 *   5. Notes — user-owned free-text (only editable surface on page)
 */

const ENT = {
  name: "Kōwhai Logistics Ltd",
  nzbn: "9429044031210",
  companyNumber: "4421107",
  status: "In Liquidation",
  statusSev: "red",
  statusSince: "2026-01-12",
  industry: "Road freight transport",
  industryCode: "ANZSIC 4610",
  region: "Auckland",
  incorporated: "2013-05-17",
  onWatchSince: "2024-11-03",
  lastSweep: "2026-04-25T06:04:00+12:00",
  nextSweep: "2026-04-26T06:00:00+12:00",
  addresses: {
    registered: "Unit 4 / 18 Airpark Drive, Māngere, Auckland 2022",
    service:    "14 Quay Street, Auckland Central, Auckland 1010",
    postal:     "PO Box 53-114, Māngere, Auckland 2150",
  },
  directorCount: { current: 1, previous: 1, changes30d: 0 },
  shareholderCount: { current: 2, previous: 2, topHolding: 75 },
  filings: {
    annualReturnDue: "2026-05-31",
    annualReturnLastFiled: "2025-05-28",
    financialStatementsLastFiled: "2025-08-14",
    overdueCount: 0,
  },
  liquidator: {
    firm: "Waterstone Insolvency",
    appointed: "2026-01-12",
    firstMeeting: "2026-01-26",
    noticeId: "gz-2026-ln1012",
  },
};

const TIMELINE = [
  { id: "t1", date: "2026-01-13", time: "07:12", sev: "red",   trigger: 13, type: "Company insolvency", source: "Companies Office / NZBN", title: "Liquidator appointed",
    description: "Voluntary liquidation filed by the sole director. First creditors' meeting scheduled within 10 working days under s243 Companies Act.",
    prev: { entity_status: "Registered", liquidator: null },
    next: { entity_status: "In Liquidation", liquidator: "Waterstone Insolvency", appointed_on: "2026-01-12" },
    ai: "Immediate exposure on outstanding invoices. Debt likely unrecoverable without secured interest. File proof of debt within 10 working days." },
  { id: "t2", date: "2026-01-13", time: "06:02", sev: "red",   trigger: 79, type: "Gazette notice", source: "NZ Gazette", title: "Gazette — winding up notice",
    description: "Notice of appointment of liquidator published in NZ Gazette.",
    prev: null,
    next: { notice_id: "gz-2026-ln1012", url: "https://gazette.govt.nz/notice/id/2026-ln1012" },
    ai: null },
  { id: "t3", date: "2026-01-04", time: "16:22", sev: "amber", trigger: 12, type: "Address change", source: "Companies Office / NZBN", title: "Service address changed",
    description: "Service address changed to 14 Quay Street, Auckland Central.",
    prev: { service_address: "Unit 4 / 18 Airpark Drive, Māngere, Auckland 2022" },
    next: { service_address: "14 Quay Street, Auckland Central, Auckland 1010" },
    ai: "Service address moved from commercial premises to CBD solicitor district — often precedes a status change. Watch closely." },
  { id: "t4", date: "2025-12-18", time: "11:04", sev: "amber", trigger: 41, type: "Shareholder change", source: "Companies Office / NZBN", title: "Shareholding restructure",
    description: "One shareholder exited. Remaining two shareholders now hold 75% and 25% (was 55% / 25% / 20%).",
    prev: { holders: 3, top_pct: 55 },
    next: { holders: 2, top_pct: 75 },
    ai: null },
  { id: "t5", date: "2025-10-02", time: "09:00", sev: "green", trigger: 20, type: "Filing & compliance", source: "Companies Office / NZBN", title: "Financial statements filed",
    description: "Audited statements for year ended 31 March 2025 filed on time.",
    prev: null,
    next: { period: "FY25", filed_on: "2025-10-02" },
    ai: null },
  { id: "t6", date: "2025-05-28", time: "08:30", sev: "green", trigger: 20, type: "Filing & compliance", source: "Companies Office / NZBN", title: "Annual return filed",
    description: "Annual return filed for the 2025 period.",
    prev: null,
    next: { filed_on: "2025-05-28", next_due: "2026-05-31" },
    ai: null },
  { id: "t7", date: "2024-11-03", time: "00:00", sev: "green", trigger: 0,  type: "Watchlist · baseline", source: "Mihari · baseline snapshot", title: "Added to watchlist",
    description: "Baseline snapshot captured. Entity was Registered with 1 director, 3 shareholders, annual filings current.",
    prev: null, next: null, ai: null, baseline: true },
];

const TOC = [
  { id: "overview",     k: "概", label: "Overview" },
  { id: "timeline",     k: "歴", label: "Timeline" },
  { id: "directors",    k: "役", label: "Directors" },
  { id: "shareholders", k: "株", label: "Shareholders" },
  { id: "addresses",    k: "所", label: "Addresses" },
  { id: "filings",      k: "届", label: "Filings" },
  { id: "recipients",   k: "宛", label: "Recipients" },
  { id: "notes",        k: "記", label: "Notes" },
];

const Entity = ({ theme }) => {
  const { C } = theme;
  const [active, setActive] = React.useState("overview");
  const [openDiffs, setOpenDiffs] = React.useState(new Set(["t1", "t3"]));
  const [notes, setNotes] = React.useState(
    "Called Waterstone 13 Jan — proof-of-debt forms emailed to AP. Unsecured exposure on 3 invoices totalling $28,140. Flag for write-off review at month end."
  );

  const [wide, setWide] = React.useState(typeof window !== "undefined" ? window.innerWidth >= 1280 : true);
  React.useEffect(() => {
    const onR = () => setWide(window.innerWidth >= 1280);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const toggleDiff = (id) => {
    const n = new Set(openDiffs); n.has(id) ? n.delete(id) : n.add(id); setOpenDiffs(n);
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });

  return (
    <main style={{
      display: "grid",
      gridTemplateColumns: wide ? "220px minmax(0,1fr)" : "minmax(0,1fr)",
      color: C.ink, fontFamily: FONTS.serif,
    }}>
      {/* ── TOC rail (wide) ─────────────────────────────── */}
      {wide && (
        <aside style={{
          borderRight: `1px solid ${C.rule}`,
          padding: "48px 0 80px",
          position: "sticky", top: 42, alignSelf: "flex-start",
          height: "calc(100vh - 42px)",
        }}>
          <div style={{
            fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "0 32px 14px",
          }}>On this page</div>
          {TOC.map(t => {
            const isA = active === t.id;
            return (
              <a key={t.id} href={`#${t.id}`} onClick={() => setActive(t.id)} style={{
                display: "grid", gridTemplateColumns: "28px 1fr",
                gap: 14, alignItems: "center",
                padding: "10px 32px",
                textDecoration: "none",
                borderLeft: `2px solid ${isA ? C.vermillion : "transparent"}`,
                background: isA ? C.panel : "transparent",
              }}>
                <span style={{
                  fontFamily: FONTS.mincho, fontSize: 18, fontWeight: 500,
                  color: isA ? C.vermillion : C.inkFaint,
                }}>{t.k}</span>
                <span style={{
                  fontFamily: FONTS.serif, fontSize: 15,
                  color: isA ? C.ink : C.inkDim,
                  letterSpacing: "-0.005em",
                }}>{t.label}</span>
              </a>
            );
          })}
        </aside>
      )}

      {/* ── Main column ─────────────────────────────────── */}
      <div style={{ padding: "clamp(28px, 4vw, 48px) clamp(20px, 4vw, 64px) 120px", minWidth: 0 }}>

        {/* narrow TOC chips */}
        {!wide && (
          <div style={{
            display: "flex", gap: 6, overflowX: "auto", marginBottom: 22,
            padding: "0 0 6px", borderBottom: `1px solid ${C.ruleSoft}`,
          }}>
            {TOC.map(t => (
              <a key={t.id} href={`#${t.id}`} style={{
                flex: "0 0 auto", padding: "6px 10px",
                fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
                color: C.inkDim, textDecoration: "none",
                borderBottom: `2px solid transparent`,
              }}>
                <span style={{ fontFamily: FONTS.mincho, color: C.inkFaint, marginRight: 6 }}>{t.k}</span>
                {t.label}
              </a>
            ))}
          </div>
        )}

        {/* ── 1 · Masthead ──────────────────────────────── */}
        <section id="overview" style={{ scrollMarginTop: 60 }}>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: 24, flexWrap: "wrap",
          }}>
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              <Label num="iv." jp="会社" C={C}>Entity detail</Label>
              <h1 style={{
                fontFamily: FONTS.serif, fontSize: "clamp(40px, 5.2vw, 68px)",
                fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.03,
                margin: "18px 0 0", color: C.ink, textWrap: "pretty",
              }}>{ENT.name}</h1>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center",
                marginTop: 18, fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500,
              }}>
                <span style={{ fontFamily: FONTS.mincho, fontSize: 13, letterSpacing: "0.1em" }}>NZBN · {ENT.nzbn}</span>
                <span style={{ color: C.inkFaint }}>│</span>
                <span>Company no. {ENT.companyNumber}</span>
                <span style={{ color: C.inkFaint }}>│</span>
                <span>Incorporated {fmtDate(ENT.incorporated)}</span>
              </div>

              {/* Status banner */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                marginTop: 28, padding: "18px 22px",
                border: `1px solid ${C.vermillion}`, background: C.panel,
              }}>
                <SevKanji sev={ENT.statusSev} size={36} C={C} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.ink, letterSpacing: "-0.01em" }}>
                    <em style={{ fontWeight: 300 }}>Status · </em>{ENT.status}
                  </div>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>
                    Changed {fmtDate(ENT.statusSince)} · liquidator {ENT.liquidator.firm} appointed · first meeting {fmtDate(ENT.liquidator.firstMeeting)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, minWidth: 220 }}>
              <button style={{
                background: C.ink, color: C.bg, border: `1px solid ${C.ink}`,
                fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600,
                padding: "12px 18px", cursor: "pointer", textAlign: "left",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>Open at Companies Office</span>
                <span style={{ color: C.inkDim }}>↗</span>
              </button>
              <button style={{
                background: "none", color: C.ink, border: `1px solid ${C.rule}`,
                fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
                padding: "12px 18px", cursor: "pointer", textAlign: "left",
              }}>View at NZBN register ↗</button>
              <button style={{
                background: "none", color: C.ink, border: `1px solid ${C.rule}`,
                fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
                padding: "12px 18px", cursor: "pointer", textAlign: "left",
              }}>See gazette notice ↗</button>
              <button style={{
                background: "none", color: C.inkDim, border: `1px solid ${C.rule}`,
                fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
                padding: "12px 18px", cursor: "pointer", textAlign: "left",
              }}>Mute 7 days</button>
              <button style={{
                background: "none", color: C.vermillion, border: `1px solid ${C.rule}`,
                fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
                padding: "12px 18px", cursor: "pointer", textAlign: "left",
              }}>Remove from watchlist</button>
            </div>
          </div>

          {/* ── 2 · Particulars strip ──────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
            border: `1px solid ${C.rule}`, marginTop: 40,
          }}>
            {[
              { jp: "業", label: "Industry",       value: ENT.industry,                sub: `${ENT.industryCode} · ${ENT.region}` },
              { jp: "録", label: "Registered",     value: fmtDate(ENT.incorporated),   sub: `${Math.floor((new Date() - new Date(ENT.incorporated))/31557600000)} yrs trading` },
              { jp: "名", label: "On watch since", value: fmtDate(ENT.onWatchSince),   sub: "17 months under watch" },
              { jp: "掃", label: "Last sweep",     value: fmtTime(ENT.lastSweep) + " NZST", sub: "Next at " + fmtTime(ENT.nextSweep) + " NZST" },
            ].map((p, i) => (
              <div key={p.label} style={{
                padding: "22px 24px",
                borderLeft: i > 0 && (wide || i % 2 === 1) ? `1px solid ${C.ruleSoft}` : "none",
                borderTop: !wide && i >= 2 ? `1px solid ${C.ruleSoft}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 12, color: C.inkFaint, letterSpacing: "0.2em" }}>{p.jp}</span>
                  <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{p.label}</span>
                </div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{p.value}</div>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 5 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3 · Timeline ─────────────────────────────── */}
        <SectionHeader C={C} num="i." jp="歴" id="timeline" title="Timeline" sub={`${TIMELINE.length} recorded events — since watch began ${fmtDate(ENT.onWatchSince)}`} />

        <div style={{ border: `1px solid ${C.rule}`, background: C.bg }}>
          {TIMELINE.map((e, i) => (
            <TimelineRow key={e.id} e={e} i={i} C={C} open={openDiffs.has(e.id)} onToggle={() => toggleDiff(e.id)} wide={wide} />
          ))}
        </div>

        {/* ── 4 · Directors ────────────────────────────── */}
        <SectionHeader C={C} num="ii." jp="役" id="directors" title="Directors" sub="Counts and movement only. Full public listing is at the Companies Office." />

        <PrivacyCard C={C}>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(3, 1fr)" : "1fr", gap: 0, border: `1px solid ${C.rule}`, background: C.bg }}>
            <FactCell C={C} label="Current directors" value={ENT.directorCount.current} sub="1 person" />
            <FactCell C={C} label="Change · last 30 days" value={ENT.directorCount.changes30d} sub="No appointments or resignations" border={wide} />
            <FactCell C={C} label="Movement since baseline" value="0" sub="Stable since 2024-11-03" border={wide} />
          </div>
          <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.6, margin: "18px 0 0" }}>
            Mihari does not surface natural-person names from registry data. To view the directors on record, open the entity at the Companies Office.
          </p>
        </PrivacyCard>

        {/* ── 5 · Shareholders ─────────────────────────── */}
        <SectionHeader C={C} num="iii." jp="株" id="shareholders" title="Shareholders" sub="Counts and top-holding concentration only." />

        <PrivacyCard C={C}>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(3, 1fr)" : "1fr", gap: 0, border: `1px solid ${C.rule}`, background: C.bg }}>
            <FactCell C={C} label="Shareholders on record" value={ENT.shareholderCount.current} sub={`Was ${ENT.shareholderCount.previous + 1} at baseline`} />
            <FactCell C={C} label="Top holding" value={`${ENT.shareholderCount.topHolding}%`} sub="Concentration increased 18 Dec 2025" border={wide} />
            <FactCell C={C} label="Movements · last 90 days" value="1" sub="One shareholder exited" border={wide} />
          </div>
        </PrivacyCard>

        {/* ── 6 · Addresses ────────────────────────────── */}
        <SectionHeader C={C} num="iv." jp="所" id="addresses" title="Addresses" sub="Registered, service, and postal addresses held on the NZBN record." />

        <div style={{ border: `1px solid ${C.rule}`, background: C.bg }}>
          {[
            { label: "Registered office", jp: "本店", value: ENT.addresses.registered, changed: false },
            { label: "Service address",   jp: "送達", value: ENT.addresses.service,    changed: true, changedOn: "2026-01-04" },
            { label: "Postal address",    jp: "郵便", value: ENT.addresses.postal,     changed: false },
          ].map((a, i) => (
            <div key={a.label} style={{
              display: "grid",
              gridTemplateColumns: wide ? "200px minmax(0,1fr) 160px" : "minmax(0,1fr)",
              padding: "22px 24px",
              borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
              gap: wide ? 0 : 10,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 12, color: C.inkFaint, letterSpacing: "0.2em" }}>{a.jp}</span>
                  <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{a.label}</span>
                </div>
              </div>
              <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.ink, letterSpacing: "-0.005em", lineHeight: 1.4 }}>{a.value}</div>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, color: a.changed ? C.amber : C.inkDim, textAlign: wide ? "right" : "left" }}>
                {a.changed ? `● changed ${fmtDate(a.changedOn)}` : "stable"}
              </div>
            </div>
          ))}
        </div>

        {/* ── 7 · Filings ──────────────────────────────── */}
        <SectionHeader C={C} num="v." jp="届" id="filings" title="Filings & compliance" sub="Statutory filings with the Companies Office." />

        <div style={{ border: `1px solid ${C.rule}`, background: C.bg, display: "grid", gridTemplateColumns: wide ? "repeat(2, 1fr)" : "1fr" }}>
          <FactCell C={C} label="Annual return · last filed" value={fmtDate(ENT.filings.annualReturnLastFiled)} sub={`Next due ${fmtDate(ENT.filings.annualReturnDue)}`} />
          <FactCell C={C} label="Financial statements · last filed" value={fmtDate(ENT.filings.financialStatementsLastFiled)} sub="FY25 · filed on time" border={wide} />
          <FactCell C={C} label="Overdue filings" value={ENT.filings.overdueCount} sub={ENT.filings.overdueCount === 0 ? "No outstanding filings" : "Requires attention"} border={false} top />
          <FactCell C={C} label="Compliance posture" value="Routine" sub="Last year of filings all lodged within window" border={wide} top />
        </div>

        {/* ── 8 · Recipients ───────────────────────────── */}
        <SectionHeader C={C} num="vi." jp="宛" id="recipients" title="Recipients" sub="Who gets alerts about this specific entity. Inherits your default list — override here when one borrower deserves a different escalation path." />

        <EntityRecipients C={C} wide={wide} />

        {/* ── 9 · Notes ────────────────────────────────── */}
        <SectionHeader C={C} num="vii." jp="記" id="notes" title="Notes" sub="Private to your account. Not shared with the entity or other users." />

        <div style={{ border: `1px solid ${C.rule}`, background: C.panel, padding: 4 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              fontFamily: FONTS.serif, fontSize: 16, lineHeight: 1.6, color: C.ink,
              padding: "20px 22px", resize: "vertical",
            }}
          />
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 22px", borderTop: `1px solid ${C.ruleSoft}`,
            fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
          }}>
            <span>Saved automatically · last edit 2h ago</span>
            <span>{notes.length} characters</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, paddingTop: 24, borderTop: `1px solid ${C.ruleSoft}`,
          fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <span>All data sourced from NZBN, Companies Office, NZ Gazette · last sweep {fmtTime(ENT.lastSweep)} NZST · 見</span>
          <a href="#" style={{ color: C.ai, textDecoration: "none" }}>Request a re-sweep →</a>
        </div>
      </div>
    </main>
  );
};

// ── Small components ────────────────────────────────────

const DEFAULT_RECIPIENTS_E = ["josh@mihari.nz", "ap@mihari.nz", "credit@mihari.nz"];
// Kōwhai is escalated — adds legal + liquidations, keeps all defaults.
const ENTITY_RECIP_OVERRIDE_INITIAL = {
  add:    ["legal@mihari.nz", "liquidations@mihari.nz"],
  remove: [],
};

const EntityRecipients = ({ C, wide }) => {
  const [override, setOverride] = React.useState(ENTITY_RECIP_OVERRIDE_INITIAL);
  const [draft, setDraft] = React.useState("");
  const [severityFor, setSeverityFor] = React.useState({
    "josh@mihari.nz":         ["red", "amber", "green"],
    "ap@mihari.nz":           ["red", "amber"],
    "credit@mihari.nz":       ["red"],
    "legal@mihari.nz":        ["red"],
    "liquidations@mihari.nz": ["red"],
  });

  const isOverridden = override.add.length > 0 || override.remove.length > 0;
  const computed = React.useMemo(() => {
    const s = new Set(DEFAULT_RECIPIENTS_E);
    override.remove.forEach(e => s.delete(e));
    override.add.forEach(e => s.add(e));
    return [...s];
  }, [override]);

  const removeRecip = (email) => {
    if (DEFAULT_RECIPIENTS_E.includes(email)) {
      setOverride(o => ({ ...o, remove: [...o.remove, email], add: o.add.filter(e => e !== email) }));
    } else {
      setOverride(o => ({ ...o, add: o.add.filter(e => e !== email) }));
    }
  };
  const addRecip = () => {
    const e = draft.trim();
    if (!e || computed.includes(e)) return;
    if (DEFAULT_RECIPIENTS_E.includes(e)) {
      setOverride(o => ({ ...o, remove: o.remove.filter(x => x !== e) }));
    } else {
      setOverride(o => ({ ...o, add: [...o.add, e] }));
    }
    setSeverityFor(s => ({ ...s, [e]: s[e] || ["red", "amber"] }));
    setDraft("");
  };
  const toggleSev = (email, sev) => {
    setSeverityFor(s => ({
      ...s,
      [email]: s[email]?.includes(sev) ? s[email].filter(x => x !== sev) : [...(s[email] || []), sev],
    }));
  };
  const reset = () => setOverride({ add: [], remove: [] });

  return (
    <div>
      {/* Banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        padding: "18px 24px",
        border: `1px solid ${C.rule}`,
        borderLeft: `3px solid ${isOverridden ? C.vermillion : C.green}`,
        background: C.panel,
        marginBottom: -1, // tuck into the card below
      }}>
        <span style={{ fontFamily: FONTS.mincho, fontSize: 22, color: isOverridden ? C.vermillion : C.green, letterSpacing: "0.1em" }}>
          {isOverridden ? "例外" : "既定"}
        </span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, letterSpacing: "-0.01em" }}>
            {isOverridden ? "This entity overrides the default recipients." : "Using your default recipients."}
          </div>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>
            {isOverridden
              ? `${override.add.length} added · ${override.remove.length} removed · changes apply to this entity only`
              : "Alerts for this entity route to whoever is set as your default. Edit defaults from Preferences."}
          </div>
        </div>
        {isOverridden && (
          <button onClick={reset} style={{
            background: "none", color: C.ink, border: `1px solid ${C.rule}`,
            fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500,
            padding: "8px 14px", cursor: "pointer", letterSpacing: "0.04em",
          }}>
            Reset to default
          </button>
        )}
        <a href="#" style={{
          fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500,
          color: C.ai, textDecoration: "none", letterSpacing: "0.04em",
        }}>
          Edit defaults →
        </a>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${C.rule}`, background: C.bg }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: wide ? "minmax(0,2fr) 160px minmax(0,1.2fr) 80px" : "minmax(0,1fr) 80px",
          borderBottom: `1px solid ${C.rule}`,
          fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <div style={{ padding: "14px 22px" }}>Address</div>
          {wide && <div style={{ padding: "14px 0" }}>Severity</div>}
          {wide && <div style={{ padding: "14px 0" }}>Source</div>}
          <div style={{ padding: "14px 22px 14px 0", textAlign: "right" }}></div>
        </div>

        {/* Rows */}
        {computed.map((email, i) => {
          const source = override.add.includes(email)
            ? "added"
            : DEFAULT_RECIPIENTS_E.includes(email) ? "inherited" : "added";
          const sevs = severityFor[email] || ["red", "amber"];
          const isPrimary = email === "josh@mihari.nz";
          return (
            <div key={email} style={{
              display: "grid",
              gridTemplateColumns: wide ? "minmax(0,2fr) 160px minmax(0,1.2fr) 80px" : "minmax(0,1fr) 80px",
              alignItems: "center",
              borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
            }}>
              <div style={{ padding: "20px 22px" }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {email}
                  {isPrimary && <span style={{ fontFamily: FONTS.gothic, fontSize: 9, fontWeight: 600, background: C.ai, color: C.bg, padding: "2px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>primary</span>}
                </div>
                {!wide && (
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>
                    {source === "inherited" ? "Inherited from default" : "Added for this entity"} · {sevs.length === 3 ? "all severities" : sevs.map(s => ({ red: "red", amber: "amber", green: "green" }[s])).join(" + ")}
                  </div>
                )}
              </div>
              {wide && (
                <div style={{ padding: "20px 0", display: "flex", gap: 6 }}>
                  {["red","amber","green"].map(s => {
                    const on = sevs.includes(s);
                    return (
                      <button key={s} onClick={() => toggleSev(email, s)} style={{
                        width: 26, height: 26,
                        background: on ? ({red:C.vermillion,amber:C.amber,green:C.green}[s]) : "transparent",
                        border: on ? "none" : `1px solid ${C.rule}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: FONTS.mincho, fontSize: 13, fontWeight: 700,
                        color: on ? C.bg : C.inkFaint,
                        cursor: "pointer", padding: 0,
                      }}>{({red:"紅",amber:"琥",green:"青"}[s])}</button>
                    );
                  })}
                </div>
              )}
              {wide && (
                <div style={{ padding: "20px 16px 20px 0", fontFamily: FONTS.gothic, fontSize: 12, color: source === "inherited" ? C.inkDim : C.vermillion, fontWeight: 500 }}>
                  {source === "inherited" ? "● Inherited from default" : "● Added for this entity"}
                </div>
              )}
              <div style={{ padding: "20px 22px 20px 0", textAlign: "right" }}>
                {!isPrimary && (
                  <button onClick={() => removeRecip(email)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500,
                  }}>Remove</button>
                )}
              </div>
            </div>
          );
        })}

        {/* Removed defaults (struck through, restorable) */}
        {override.remove.map(email => (
          <div key={email} style={{
            display: "grid",
            gridTemplateColumns: wide ? "minmax(0,2fr) 160px minmax(0,1.2fr) 80px" : "minmax(0,1fr) 80px",
            alignItems: "center",
            borderTop: `1px solid ${C.ruleSoft}`,
            background: `linear-gradient(transparent, transparent)`,
            opacity: 0.6,
          }}>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.inkFaint, letterSpacing: "-0.005em", textDecoration: "line-through" }}>
                {email}
              </div>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>
                Removed from this entity only — still a default recipient elsewhere
              </div>
            </div>
            {wide && <div />}
            {wide && <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500 }}>● Suppressed</div>}
            <div style={{ padding: "20px 22px 20px 0", textAlign: "right" }}>
              <button onClick={() => setOverride(o => ({ ...o, remove: o.remove.filter(x => x !== email) }))} style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.ai, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500,
              }}>Restore</button>
            </div>
          </div>
        ))}

        {/* Add row */}
        <div style={{
          borderTop: `1px solid ${C.ruleSoft}`,
          padding: "18px 22px",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          background: C.panel,
        }}>
          <span style={{ fontFamily: FONTS.mincho, fontSize: 18, color: C.vermillion, letterSpacing: "0.1em" }}>＋</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addRecip(); }}
            placeholder="Add an email address for this entity only…"
            style={{
              flex: 1, minWidth: 240,
              background: "transparent", border: "none", outline: "none",
              fontFamily: FONTS.serif, fontSize: 18, color: C.ink,
              padding: "4px 0",
              borderBottom: `1px dashed ${C.rule}`,
            }}
          />
          <button onClick={addRecip} style={{
            background: draft.trim() ? C.ink : "transparent",
            color: draft.trim() ? C.bg : C.inkFaint,
            border: `1px solid ${draft.trim() ? C.ink : C.rule}`,
            fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 600,
            padding: "8px 16px", cursor: draft.trim() ? "pointer" : "default",
            letterSpacing: "0.04em",
          }}>
            Add to this entity
          </button>
        </div>
      </div>

      <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.6, marginTop: 18, maxWidth: 720 }}>
        Per-entity overrides apply <em>only</em> here. If you remove a default, that recipient continues to receive alerts for every other entity on your watchlist — silenced on this one alone.
      </p>
    </div>
  );
};

const SectionHeader = ({ C, num, jp, id, title, sub }) => (
  <div id={id} style={{ margin: "72px 0 20px", scrollMarginTop: 60 }}>
    <Label num={num} jp={jp} C={C}>{title}</Label>
    <h2 style={{
      fontFamily: FONTS.serif, fontSize: "clamp(28px, 3.4vw, 40px)",
      fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1,
      margin: "14px 0 6px", color: C.ink,
    }}>{title}.</h2>
    <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, lineHeight: 1.55, maxWidth: 720 }}>{sub}</div>
  </div>
);

const FactCell = ({ C, label, value, sub, border, top }) => (
  <div style={{
    padding: "22px 24px",
    borderLeft: border ? `1px solid ${C.ruleSoft}` : "none",
    borderTop: top ? `1px solid ${C.ruleSoft}` : "none",
  }}>
    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontFamily: FONTS.serif, fontSize: 40, fontWeight: 300, letterSpacing: "-0.03em", color: C.ai, lineHeight: 1.05, margin: "10px 0 6px" }}>{value}</div>
    <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, lineHeight: 1.5 }}>{sub}</div>
  </div>
);

const PrivacyCard = ({ C, children }) => (
  <div>{children}</div>
);

const TimelineRow = ({ e, i, C, open, onToggle, wide }) => {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-NZ", { month: "short", day: "numeric" });
  const yr = new Date(e.date).getFullYear();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: wide ? "120px 40px minmax(0,1fr) 140px" : "40px minmax(0,1fr) auto",
      gap: wide ? 24 : 14,
      padding: "28px 28px",
      borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
      alignItems: "start",
      background: e.baseline ? C.panel : "transparent",
    }}>
      {wide && (
        <div style={{ fontFamily: FONTS.serif, fontSize: 18, color: C.inkDim, letterSpacing: "-0.01em", paddingTop: 2 }}>
          <div style={{ color: C.ink }}>{fmtDate(e.date)}</div>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500, marginTop: 3 }}>{yr} · {e.time}</div>
        </div>
      )}
      <SevKanji sev={e.sev} size={wide ? 32 : 26} C={C} />
      <div style={{ minWidth: 0 }}>
        {!wide && (
          <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginBottom: 6 }}>
            {fmtDate(e.date)} {yr} · {e.time}
          </div>
        )}
        <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
          {e.type}{e.trigger > 0 ? ` · trigger #${e.trigger}` : ""} · {e.source}
        </div>
        <h3 style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.25, margin: 0, color: C.ink }}>{e.title}</h3>
        {e.description && (
          <p style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.ink, lineHeight: 1.55, margin: "10px 0 0", maxWidth: 720 }}>{e.description}</p>
        )}
        {e.ai && (
          <div style={{
            marginTop: 14, padding: "14px 18px",
            borderLeft: `1px solid ${C.ai}`, background: C.panel,
          }}>
            <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.ai, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Ai note · 藍</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 15, fontStyle: "italic", color: C.ink, lineHeight: 1.5 }}>{e.ai}</div>
          </div>
        )}
        {(e.prev || e.next) && (
          <div style={{ marginTop: 14 }}>
            <button onClick={onToggle} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 500, letterSpacing: "0.04em",
            }}>
              {open ? "− Hide change" : "+ Show change"}
            </button>
            {open && (
              <div style={{
                display: "grid", gridTemplateColumns: wide && e.prev && e.next ? "1fr 1fr" : "1fr",
                gap: 0, marginTop: 10, border: `1px solid ${C.ruleSoft}`,
              }}>
                {e.prev && (
                  <DiffBlock C={C} title="Previous" jp="前" data={e.prev} color={C.inkDim} />
                )}
                {e.next && (
                  <DiffBlock C={C} title="Current" jp="今" data={e.next} color={e.sev === "red" ? C.vermillion : (e.sev === "amber" ? C.amber : C.ai)} border={wide && e.prev} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {wide && (
        <div style={{ textAlign: "right", fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, paddingTop: 6 }}>
          {e.baseline ? <span style={{ border: `1px solid ${C.rule}`, padding: "2px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>baseline</span> : `#${e.trigger || "—"}`}
        </div>
      )}
    </div>
  );
};

const DiffBlock = ({ C, title, jp, data, color, border }) => (
  <div style={{
    padding: "14px 18px",
    borderLeft: border ? `1px solid ${C.ruleSoft}` : "none",
    background: C.panel,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color, letterSpacing: "0.2em" }}>{jp}</span>
      <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
    </div>
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500 }}>
      {Object.entries(data).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt style={{ color: C.inkDim }}>{k}</dt>
          <dd style={{ margin: 0, color: C.ink, fontFamily: FONTS.serif, fontSize: 14, wordBreak: "break-word" }}>
            {v === null ? <span style={{ color: C.inkFaint, fontStyle: "italic" }}>none</span> : String(v)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

window.Entity = Entity;
