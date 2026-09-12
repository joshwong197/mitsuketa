/* Mihari — Alerts feed
 *
 * Layout: 3-column
 *   Left  (260) — Filter rail: severity, alert_type (14 toggles),
 *                 unread-only, date range, group-by-entity switch.
 *   Centre      — Entity-grouped list OR flat chronological list.
 *                 Editorial, airy, severity kanji drives hierarchy.
 *   Right (420) — Selected alert detail: previous vs new JSON diff,
 *                 source + trigger #, ai_risk_summary, actions.
 *
 * Every data point is traceable. Show Data Sources toggle in header.
 */

const TOGGLE_META = [
  { key: "entity_status_change", label: "Status changes",        jp: "状態", count: 1,  note: "Struck off, restored, etc." },
  { key: "company_insolvency",   label: "Company insolvency",    jp: "破産", count: 8,  note: "Liquidation, receivership, VA" },
  { key: "personal_insolvency",  label: "Personal insolvency",   jp: "個人", count: 6,  note: "Director bankruptcy, NAP" },
  { key: "director_change",      label: "Director changes",      jp: "役員", count: 1,  note: "Appointed / resigned" },
  { key: "officer_role_change",  label: "Officer role changes",  jp: "職員", count: 8,  note: "Trustees, partners, secretaries" },
  { key: "shareholder_change",   label: "Shareholder changes",   jp: "株主", count: 3,  note: "Shareholding, UHC, listing" },
  { key: "name_change",          label: "Name changes",          jp: "名義", count: 2,  note: "Entity or trading name" },
  { key: "address_change",       label: "Address changes",       jp: "住所", count: 8,  note: "Registered, service, postal…" },
  { key: "gazette_notice",       label: "Gazette notices",       jp: "官報", count: 5,  note: "Creditors' mtg, s289, wind-up" },
  { key: "filing_compliance",    label: "Filing & compliance",   jp: "届出", count: 6,  note: "Annual returns, financials" },
  { key: "contact_change",       label: "Contact changes",       jp: "連絡", count: 4,  note: "Phone, email, website" },
  { key: "business_profile",     label: "Business profile",      jp: "業種", count: 9,  note: "Industry, trading area, GST" },
  { key: "disqualified_director",label: "Disqualified directors",jp: "失格", count: 1,  note: "Cross-check against disq list" },
  { key: "cross_entity_risk",    label: "Cross-entity risk",     jp: "関連", count: 3,  note: "Directors linked to distress" },
];

// Demo alerts — shape exactly matches alerts + entities + alert_recipients
const DEMO = [
  {
    entity: { id: "e1", entity_name: "Kōwhai Logistics Ltd", nzbn: "9429044031210", entity_status: "In Liquidation" },
    alerts: [
      { id: "a1", alert_type: "company_insolvency", trigger_number: 13, severity: "red", title: "Liquidator appointed", description: "Voluntary liquidation filed by the sole director. First creditors' meeting scheduled within 10 working days under s243 Companies Act.", ai_risk_summary: "Immediate exposure on outstanding invoices. Debt likely unrecoverable without secured interest. Contact Waterstone Insolvency for proof-of-debt forms.", source: "Companies Office / NZBN", created_at: "2026-01-13T07:12:00+13:00", is_read: false, previous_value: { entity_status: "Registered", liquidator: null }, new_value: { entity_status: "In Liquidation", liquidator: "Waterstone Insolvency", appointed_on: "2026-01-12" }, is_baseline: false },
      { id: "a1b", alert_type: "gazette_notice", trigger_number: 79, severity: "red", title: "Gazette — winding up notice", description: "Notice of appointment of liquidator published in NZ Gazette.", source: "NZ Gazette", created_at: "2026-01-13T06:02:00+13:00", is_read: false, new_value: { notice_id: "gz-2026-ln1012", url: "https://gazette.govt.nz/notice/id/2026-ln1012" }, is_baseline: false },
    ],
  },
  {
    entity: { id: "e2", entity_name: "Parnell Craft Coffee Ltd", nzbn: "9429050138844", entity_status: "Registered" },
    alerts: [
      { id: "a2", alert_type: "gazette_notice", trigger_number: 71, severity: "red", title: "Statutory demand — s289", description: "Demand for $84,220 served. 15 working days to comply before creditor can apply to liquidate.", ai_risk_summary: "Serious cashflow signal. 10 working days remain. Review outstanding balance urgently.", source: "NZ Gazette", created_at: "2026-01-13T02:15:00+13:00", is_read: false, new_value: { amount: 84220, currency: "NZD", notice_type: "md" }, is_baseline: false },
    ],
  },
  {
    entity: { id: "e3", entity_name: "Harbourline Freight Ltd", nzbn: "9429031180944", entity_status: "Registered" },
    alerts: [
      { id: "a3", alert_type: "director_change", trigger_number: 26, severity: "amber", title: "Director resigned", description: "One director ceased; 2 of 3 remain. No replacement filed. No natural-person name is shown on-screen — see Companies Office record for the public listing.", source: "Companies Office / NZBN", created_at: "2026-01-13T06:48:00+13:00", is_read: false, previous_value: { director_count: 3 }, new_value: { director_count: 2, ceased_on: "2026-01-12", replacement_filed: false }, is_baseline: false },
      { id: "a3b", alert_type: "address_change", trigger_number: 12, severity: "amber", title: "Service address changed", description: "Changed to 14 Quay Street, Auckland Central.", source: "Companies Office / NZBN", created_at: "2026-01-12T16:22:00+13:00", is_read: true, new_value: { address: "14 Quay Street, Auckland Central" }, is_baseline: false },
    ],
  },
  {
    entity: { id: "e4", entity_name: "Mānuka & Sons Builders Ltd", nzbn: "9429041755028", entity_status: "Registered" },
    alerts: [
      { id: "a4", alert_type: "address_change", trigger_number: 5, severity: "amber", title: "Registered office changed", description: "Moved to a residential unit in Papatoetoe. Previous address was commercial premises.", source: "Companies Office / NZBN", created_at: "2026-01-13T04:22:00+13:00", is_read: true, previous_value: { address: "Unit 2 / 18 Airpark Drive, Māngere" }, new_value: { address: "42B Puhinui Road, Papatoetoe" }, is_baseline: false },
    ],
  },
  {
    entity: { id: "e5", entity_name: "Southside Plant Hire Ltd", nzbn: "9429030094415", entity_status: "Registered" },
    alerts: [
      { id: "a5", alert_type: "cross_entity_risk", trigger_number: 65, severity: "amber", title: "Director linked to distressed company", description: "A director of this entity is also a director of South Central Build Group (court liquidation commenced 2026-01-11). Review concentration risk before extending further credit.", source: "Cross-reference engine", created_at: "2026-01-13T00:10:00+13:00", is_read: false, new_value: { linked_entity: "South Central Build Group", linked_nzbn: "9429041880221", linked_status: "In Liquidation", shared_role: "Director" }, is_baseline: false },
    ],
  },
  {
    entity: { id: "e6", entity_name: "Tāwhiri Analytics Ltd", nzbn: "9429048822115", entity_status: "Registered" },
    alerts: [
      { id: "a6", alert_type: "filing_compliance", trigger_number: 20, severity: "green", title: "Annual return filed", source: "Companies Office / NZBN", created_at: "2026-01-13T05:30:00+13:00", is_read: true, new_value: { filing_date: "2026-01-13", next_due: "2027-01" }, is_baseline: false },
    ],
  },
];

const Alerts = ({ theme }) => {
  const { C } = theme;
  const [showProv, setShowProv] = React.useState(false);
  const [groupBy, setGroupBy] = React.useState("entity"); // entity | chrono
  const [severityFilter, setSeverityFilter] = React.useState(new Set(["red", "amber", "green"]));
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [activeTypes, setActiveTypes] = React.useState(new Set(TOGGLE_META.map(t => t.key)));
  const [selected, setSelected] = React.useState("a1");
  const [expanded, setExpanded] = React.useState(new Set(["e1", "e2", "e3"]));

  const toggleExp = (id) => {
    const n = new Set(expanded); n.has(id) ? n.delete(id) : n.add(id); setExpanded(n);
  };
  const toggleSev = (s) => {
    const n = new Set(severityFilter); n.has(s) ? n.delete(s) : n.add(s); setSeverityFilter(n);
  };
  const toggleType = (k) => {
    const n = new Set(activeTypes); n.has(k) ? n.delete(k) : n.add(k); setActiveTypes(n);
  };

  // Filter + flatten
  const visibleGroups = DEMO
    .map(g => ({
      ...g,
      alerts: g.alerts.filter(a =>
        severityFilter.has(a.severity) &&
        activeTypes.has(a.alert_type) &&
        (!unreadOnly || !a.is_read)
      ),
    }))
    .filter(g => g.alerts.length > 0);

  const allAlerts = visibleGroups.flatMap(g => g.alerts.map(a => ({ ...a, entity: g.entity })));
  const unreadCount = allAlerts.filter(a => !a.is_read).length;
  const selectedAlert = allAlerts.find(a => a.id === selected) || allAlerts[0];

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [wide, setWide] = React.useState(typeof window !== "undefined" ? window.innerWidth >= 1400 : true);
  React.useEffect(() => {
    const onR = () => setWide(window.innerWidth >= 1400);
    window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR);
  }, []);

  return (
    <main style={{
      display: "grid",
      gridTemplateColumns: wide ? "240px minmax(0,1fr) 400px" : "minmax(0,1fr)",
      minHeight: "calc(100vh - 42px)",
      background: C.bg, color: C.ink, fontFamily: FONTS.serif,
      position: "relative",
    }}>
      {/* ═══════ LEFT: filter rail ═══════ */}
      {(wide || filtersOpen) && <aside style={{
        borderRight: `1px solid ${C.rule}`, padding: "32px 24px 40px",
        background: C.bg,
        position: wide ? "sticky" : "fixed", top: 42, left: 260,
        width: wide ? "auto" : 300,
        height: "calc(100vh - 42px)", overflow: "auto",
        zIndex: wide ? 1 : 30,
        boxShadow: wide ? "none" : "0 0 0 100vmax rgba(0,0,0,0.4)",
      }} onClick={(e) => e.stopPropagation()}>
        <Label num="i" jp="絞り" C={C}>Filters</Label>

        {/* Severity */}
        <div style={{ marginTop: 22, marginBottom: 28 }}>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 10 }}>
            SEVERITY
          </div>
          {[
            { k: "red",   kanji: "紅", label: "Red — attention", col: C.vermillion },
            { k: "amber", kanji: "琥", label: "Amber — watch",   col: C.amber },
            { k: "green", kanji: "青", label: "Green — routine", col: C.green },
          ].map(s => {
            const on = severityFilter.has(s.k);
            return (
              <div key={s.k} onClick={() => toggleSev(s.k)} style={{
                display: "grid", gridTemplateColumns: "20px 24px 1fr",
                gap: 10, alignItems: "center",
                padding: "8px 0", cursor: "pointer",
                opacity: on ? 1 : 0.35,
              }}>
                <span style={{
                  width: 14, height: 14, border: `1px solid ${on ? s.col : C.rule}`,
                  background: on ? s.col : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: C.bg, fontFamily: FONTS.gothic, fontWeight: 700,
                }}>{on ? "✓" : ""}</span>
                <span style={{ fontFamily: FONTS.mincho, fontSize: 16, color: s.col }}>{s.kanji}</span>
                <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Unread only */}
        <div onClick={() => setUnreadOnly(!unreadOnly)} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 0", cursor: "pointer",
          borderTop: `1px solid ${C.ruleSoft}`, borderBottom: `1px solid ${C.ruleSoft}`,
          marginBottom: 28,
        }}>
          <span style={{
            width: 14, height: 14, border: `1px solid ${unreadOnly ? C.ai : C.rule}`,
            background: unreadOnly ? C.ai : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: C.bg, fontFamily: FONTS.gothic, fontWeight: 700,
          }}>{unreadOnly ? "✓" : ""}</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>Unread only</span>
        </div>

        {/* Alert categories */}
        <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
          <span>ALERT CATEGORIES</span>
          <span style={{ color: C.ai, cursor: "pointer" }} onClick={() => setActiveTypes(activeTypes.size === TOGGLE_META.length ? new Set() : new Set(TOGGLE_META.map(t => t.key)))}>
            {activeTypes.size === TOGGLE_META.length ? "none" : "all"}
          </span>
        </div>
        {TOGGLE_META.map(t => {
          const on = activeTypes.has(t.key);
          return (
            <div key={t.key} onClick={() => toggleType(t.key)} style={{
              display: "grid", gridTemplateColumns: "14px 28px 1fr auto",
              gap: 10, alignItems: "center", padding: "7px 0", cursor: "pointer",
              opacity: on ? 1 : 0.35,
            }}>
              <span style={{
                width: 12, height: 12, border: `1px solid ${on ? C.ink : C.rule}`,
                background: on ? C.ink : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, color: C.bg, fontFamily: FONTS.gothic, fontWeight: 700,
              }}>{on ? "✓" : ""}</span>
              <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color: C.inkDim, letterSpacing: "0.15em" }}>{t.jp}</span>
              <span style={{ fontFamily: FONTS.serif, fontSize: 13, color: C.ink, lineHeight: 1.3 }}>{t.label}</span>
              <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500 }}>{t.count}</span>
            </div>
          );
        })}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.rule}` }}>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 10 }}>
            DATE RANGE
          </div>
          {["Last 24 hours", "Last 7 days", "Last 30 days", "All time"].map((l, i) => (
            <div key={i} style={{
              padding: "7px 0", fontFamily: FONTS.serif, fontSize: 13,
              color: i === 1 ? C.ai : C.inkDim, cursor: "pointer",
              fontStyle: i === 1 ? "italic" : "normal",
            }}>{l}</div>
          ))}
        </div>
        {!wide && (
          <button onClick={() => setFiltersOpen(false)} style={{
            marginTop: 24, width: "100%", padding: "10px", background: C.ink, color: C.bg,
            border: "none", fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, cursor: "pointer", letterSpacing: "0.05em",
          }}>CLOSE FILTERS</button>
        )}
      </aside>}

      {/* ═══════ CENTRE: feed ═══════ */}
      <section style={{ padding: "48px 56px 120px", minWidth: 0 }}>
        {!wide && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setFiltersOpen(true)} style={{
              padding: "7px 14px", background: "none", color: C.ink,
              border: `1px solid ${C.rule}`, fontFamily: FONTS.gothic,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer",
            }}>▤ FILTERS</button>
          </div>
        )}
        {/* Masthead */}
        <header style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
            <Label num="II" jp="警報" C={C}>Alerts</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <button onClick={() => setShowProv(!showProv)} style={{
                background: showProv ? C.ai : "none", color: showProv ? C.bg : C.ai,
                border: `1px solid ${C.ai}`, padding: "5px 12px",
                fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
                cursor: "pointer",
              }}>{showProv ? "HIDE" : "SHOW"} DATA SOURCES</button>
            </div>
          </div>
          <h1 style={{
            fontFamily: FONTS.serif, fontWeight: 400, fontSize: 52, lineHeight: 1.04,
            letterSpacing: "-0.02em", color: C.ink, margin: 0,
          }}>
            {allAlerts.length} {allAlerts.length === 1 ? "change" : "changes"} across {visibleGroups.length} {visibleGroups.length === 1 ? "entity" : "entities"}
            <span style={{ color: unreadCount > 0 ? C.vermillion : C.green }}>.</span>
            <span style={{ display: "block", fontSize: 22, color: C.inkDim, marginTop: 10, letterSpacing: "-0.01em" }}>
              {unreadCount} unread · grouped {groupBy === "entity" ? "by entity" : "chronologically"}
            </span>
          </h1>

          {/* Toolbar */}
          <div style={{
            marginTop: 28, paddingBottom: 12,
            borderBottom: `1px solid ${C.rule}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
          }}>
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { k: "entity", l: "Group by entity", jp: "会社順" },
                { k: "chrono", l: "Chronological",   jp: "時刻順" },
              ].map(opt => (
                <div key={opt.k} onClick={() => setGroupBy(opt.k)} style={{
                  padding: "6px 18px", cursor: "pointer",
                  borderBottom: `2px solid ${groupBy === opt.k ? C.ink : "transparent"}`,
                  color: groupBy === opt.k ? C.ink : C.inkDim,
                  display: "flex", gap: 8, alignItems: "baseline",
                }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 11, letterSpacing: "0.15em" }}>{opt.jp}</span>
                  <span>{opt.l}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 18, color: C.inkDim }}>
              <span style={{ cursor: "pointer" }}>Export CSV</span>
              <span style={{ color: C.inkFaint }}>│</span>
              <span style={{ cursor: "pointer", color: C.ai }}>Mark all read</span>
            </div>
          </div>
          {showProv && <ProvTag C={C} sql="alerts JOIN alert_recipients r ON r.alert_id = alerts.id JOIN entities e ON e.id = alerts.entity_id WHERE r.user_id = auth.uid() AND alerts.severity = ANY($1) AND alerts.alert_type = ANY($2) AND (NOT $3 OR r.is_read = false) ORDER BY e.entity_name, alerts.created_at DESC" note="Grouping happens server-side; groups.alerts[] ordered newest first." />}
        </header>

        {/* Feed */}
        {groupBy === "entity" ? (
          visibleGroups.map((g, gi) => {
            const highestSev = g.alerts.some(a => a.severity === "red") ? "red" :
                               g.alerts.some(a => a.severity === "amber") ? "amber" : "green";
            const unread = g.alerts.filter(a => !a.is_read).length;
            const isExp = expanded.has(g.entity.id);
            return (
              <div key={g.entity.id} style={{ marginBottom: 36 }}>
                {/* Entity header */}
                <div onClick={() => toggleExp(g.entity.id)} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr auto",
                  gap: 20, alignItems: "center", padding: "16px 0",
                  borderTop: `2px solid ${highestSev === "red" ? C.vermillion : highestSev === "amber" ? C.amber : C.rule}`,
                  cursor: "pointer",
                }}>
                  <SevKanji sev={highestSev} size={36} C={C} />
                  <div>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 26, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
                      {g.entity.entity_name}
                      {unread > 0 && (
                        <span style={{
                          marginLeft: 14, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 600,
                          color: C.bg, background: C.ai, padding: "3px 7px", verticalAlign: "middle",
                          letterSpacing: "0.04em",
                        }}>{unread} NEW</span>
                      )}
                    </div>
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4, letterSpacing: "0.04em" }}>
                      NZBN {formatNzbn(g.entity.nzbn)} · {g.alerts.length} {g.alerts.length === 1 ? "ALERT" : "ALERTS"} · {relTime(g.alerts[0].created_at)}
                      {g.entity.entity_status !== "Registered" && (
                        <span style={{ color: C.vermillion, marginLeft: 10 }}>· {g.entity.entity_status.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 18, color: C.inkDim }}>
                    {isExp ? "Collapse" : "Expand"}
                  </span>
                </div>

                {/* Alert rows */}
                {isExp && g.alerts.map((a, i) => (
                  <AlertRow key={a.id} a={a} entity={g.entity} C={C}
                    selected={selected === a.id}
                    onSelect={() => { setSelected(a.id); if (!wide) setDrawerOpen(true); }}
                    showProv={showProv}
                    last={i === g.alerts.length - 1} />
                ))}
              </div>
            );
          })
        ) : (
          // Chronological view
          <div style={{ borderTop: `1px solid ${C.rule}` }}>
            {allAlerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(a => (
              <AlertRow key={a.id} a={a} entity={a.entity} C={C}
                selected={selected === a.id}
                onSelect={() => { setSelected(a.id); if (!wide) setDrawerOpen(true); }}
                showProv={showProv}
                showEntity />
            ))}
          </div>
        )}

        {/* Provenance footer */}
        {showProv && <ProvenanceFooter C={C} />}
      </section>

      {/* ═══════ RIGHT: detail drawer ═══════ */}
      {(wide || drawerOpen) && <aside style={{
        borderLeft: `1px solid ${C.rule}`, background: C.panel,
        position: wide ? "sticky" : "fixed",
        top: 42, right: 0,
        width: wide ? "auto" : "min(440px, 100vw)",
        height: "calc(100vh - 42px)", overflow: "auto",
        padding: "36px 32px 60px",
        zIndex: wide ? 1 : 40,
        boxShadow: wide ? "none" : "-12px 0 40px rgba(0,0,0,0.4)",
      }}>
        {!wide && (
          <button onClick={() => setDrawerOpen(false)} style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: `1px solid ${C.rule}`, color: C.ink,
            fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em",
            padding: "5px 10px", cursor: "pointer",
          }}>CLOSE ✕</button>
        )}
        {selectedAlert ? (
          <AlertDetail a={selectedAlert} C={C} showProv={showProv} />
        ) : (
          <div style={{ color: C.inkDim, fontStyle: "italic", fontSize: 15 }}>
            Select an alert to see the diff.
          </div>
        )}
      </aside>}
    </main>
  );
};

// ── Alert row (feed item) ─────────────────────────────────
const AlertRow = ({ a, entity, C, selected, onSelect, showProv, last, showEntity }) => {
  const typeLabel = TOGGLE_META.find(t => t.key === a.alert_type)?.label || a.alert_type;
  return (
    <article onClick={onSelect} style={{
      display: "grid", gridTemplateColumns: "84px 28px 1fr auto",
      gap: 18, padding: "20px 14px", cursor: "pointer",
      borderBottom: last ? "none" : `1px solid ${C.ruleSoft}`,
      background: selected ? (a.severity === "red" ? "rgba(227,89,74,0.06)" : "rgba(143,181,224,0.06)") : "transparent",
      borderLeft: selected ? `2px solid ${a.severity === "red" ? C.vermillion : C.ai}` : "2px solid transparent",
      opacity: a.is_read ? 0.7 : 1,
    }}>
      <div style={{ paddingTop: 3 }}>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, letterSpacing: "0.04em" }}>
          {timeOnly(a.created_at)}
        </div>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, marginTop: 2, fontWeight: 500, letterSpacing: "0.04em" }}>
          #{a.trigger_number}
        </div>
      </div>
      <SevKanji sev={a.severity} size={22} C={C} />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 500, letterSpacing: "0.08em" }}>
            {typeLabel.toUpperCase()}
          </span>
          {!a.is_read && <span style={{ width: 5, height: 5, background: C.ai, borderRadius: "50%" }} />}
          {a.is_baseline && (
            <span style={{ fontFamily: FONTS.gothic, fontSize: 9, color: C.inkFaint, border: `1px solid ${C.rule}`, padding: "1px 5px", letterSpacing: "0.06em" }}>PRE-EXISTING</span>
          )}
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em", lineHeight: 1.3 }}>
          {a.title}
        </div>
        {showEntity && entity && (
          <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 14, color: C.inkDim, marginTop: 3 }}>
            {entity.entity_name}
          </div>
        )}
        {a.description && (
          <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            {a.description}
          </div>
        )}
      </div>
      <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.05em", textAlign: "right", paddingTop: 3 }}>
        {a.source.toUpperCase().split(" / ")[0]}
      </div>
    </article>
  );
};

// ── Detail drawer ─────────────────────────────────────────
const AlertDetail = ({ a, C, showProv }) => {
  const typeLabel = TOGGLE_META.find(t => t.key === a.alert_type)?.label || a.alert_type;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <SevKanji sev={a.severity} size={24} C={C} />
        <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 600, letterSpacing: "0.1em" }}>
          TRIGGER #{a.trigger_number} · {typeLabel.toUpperCase()}
        </span>
      </div>

      <h2 style={{
        fontFamily: FONTS.serif, fontSize: 30, fontWeight: 400, letterSpacing: "-0.015em",
        lineHeight: 1.15, color: C.ink, margin: 0, marginBottom: 14,
      }}>
        {a.title}<span style={{ color: a.severity === "red" ? C.vermillion : a.severity === "amber" ? C.amber : C.green }}>.</span>
      </h2>

      <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 16, color: C.ink, marginBottom: 6 }}>
        {a.entity.entity_name}
      </div>
      <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.04em", marginBottom: 22 }}>
        NZBN {formatNzbn(a.entity.nzbn)} · {fullTime(a.created_at)}
      </div>

      {a.description && (
        <p style={{ fontFamily: FONTS.serif, fontSize: 15, lineHeight: 1.6, color: C.ink, marginBottom: 22, textWrap: "pretty" }}>
          {a.description}
        </p>
      )}

      {a.ai_risk_summary && (
        <div style={{
          padding: "14px 16px", marginBottom: 24,
          borderLeft: `2px solid ${C.aiDeep}`, background: "rgba(143,181,224,0.06)",
        }}>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.ai, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 6 }}>
            AI RISK SUMMARY
          </div>
          <p style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 14, lineHeight: 1.5, color: C.inkDim, margin: 0 }}>
            {a.ai_risk_summary}
          </p>
        </div>
      )}

      {/* Change diff */}
      {(a.previous_value || a.new_value) && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 10 }}>
            THE CHANGE
          </div>
          {a.previous_value && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500, marginBottom: 4, letterSpacing: "0.05em" }}>
                PREVIOUS
              </div>
              <pre style={{
                margin: 0, padding: "10px 12px", background: C.bg, border: `1px solid ${C.ruleSoft}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, lineHeight: 1.55,
                color: C.inkDim, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{JSON.stringify(a.previous_value, null, 2)}</pre>
            </div>
          )}
          {a.new_value && (
            <div>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.vermillion, fontWeight: 500, marginBottom: 4, letterSpacing: "0.05em" }}>
                CURRENT
              </div>
              <pre style={{
                margin: 0, padding: "10px 12px", background: C.bg, border: `1px solid ${a.severity === "red" ? C.vermillion : C.ruleSoft}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, lineHeight: 1.55,
                color: C.ink, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{JSON.stringify(a.new_value, null, 2)}</pre>
            </div>
          )}
          {showProv && <ProvTag C={C} small fields="alerts.previous_value, alerts.new_value (JSONB) — written by monitoring/differ.ts" />}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 10, marginTop: 28,
        paddingTop: 22, borderTop: `1px solid ${C.rule}`,
      }}>
        <Btn primary C={C}>{a.is_read ? "Already read" : "Mark as read"}</Btn>
        <Btn C={C}>Open entity detail →</Btn>
        <Btn C={C}>Snooze 24 hours</Btn>
        <Btn C={C} muted>Adjust alert toggles for this entity</Btn>
      </div>

      {/* Meta */}
      <div style={{
        marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.ruleSoft}`,
        fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.06em", lineHeight: 1.8,
      }}>
        <div>SOURCE · {a.source.toUpperCase()}</div>
        <div>DETECTED · {fullTime(a.created_at)}</div>
        <div>TRIGGER · #{a.trigger_number} ({a.alert_type})</div>
        {a.is_baseline && <div style={{ color: C.amber }}>PRE-EXISTING AT WATCHLIST CREATION</div>}
      </div>
    </div>
  );
};

const Btn = ({ children, primary, muted, C }) => (
  <button style={{
    width: "100%", padding: "11px 14px", cursor: "pointer",
    background: primary ? C.ink : "transparent",
    color: primary ? C.bg : muted ? C.inkDim : C.ink,
    border: primary ? "none" : `1px solid ${muted ? C.ruleSoft : C.rule}`,
    fontFamily: FONTS.serif, fontSize: 14,
    textAlign: "left",
  }}>{children}</button>
);

// ── Provenance footer ─────────────────────────────────────
const ProvenanceFooter = ({ C }) => (
  <div style={{ marginTop: 80, paddingTop: 32, borderTop: `2px solid ${C.ai}` }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
      <Label num="§" jp="出所" C={C} color={C.ai}>Data provenance</Label>
      <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 20, color: C.ink, letterSpacing: "-0.01em" }}>
        what this feed needs from your backend
      </span>
    </div>

    <div style={{ border: `1px solid ${C.rule}`, marginBottom: 28 }}>
      {[
        { t: "alerts",           c: "severity, title, description, ai_risk_summary, alert_type, trigger_number, source, created_at, is_baseline, previous_value, new_value", u: "Every row + detail drawer" },
        { t: "alert_recipients", c: "is_read, read_at",                                 u: "Unread dot, opacity, 'mark as read' action" },
        { t: "entities",         c: "entity_name, nzbn, entity_status",                 u: "Group header, detail drawer" },
        { t: "watchlist_items",  c: "alert_toggles",                                    u: "Left rail category toggles seed from here per entity" },
      ].map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "200px 1.6fr 1fr",
          padding: "12px 16px", borderBottom: i < 3 ? `1px solid ${C.ruleSoft}` : "none",
          fontSize: 12, lineHeight: 1.55, gap: 16,
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai, fontWeight: 600 }}>{r.t}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ink, fontSize: 11 }}>{r.c}</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.u}</span>
        </div>
      ))}
    </div>

    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 12 }}>
      API CONTRACT — GET /api/alerts
    </div>
    <pre style={{
      margin: 0, padding: "14px 16px", background: C.panel, border: `1px solid ${C.rule}`,
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, lineHeight: 1.6, color: C.ink,
      whiteSpace: "pre-wrap", marginBottom: 28,
    }}>{`Query params:
  group_by   = "entity" | undefined        // toggles between grouped / flat
  severity   = "red" | "amber" | "green"   // repeatable
  alert_type = <toggle_key>                // repeatable (14 keys)
  unread     = "true"
  since      = ISO 8601

Response (grouped):
  {
    groups: [{
      entity: { id, entity_name, nzbn, entity_status },
      highestSeverity: "red" | "amber" | "green",
      unreadCount: number,
      latestAt: ISO,
      alerts: AlertItem[]
    }],
    totalGroups: number
  }

AlertItem is a row from alerts JOIN alert_recipients, carrying is_read/read_at
on the join side. previous_value / new_value are JSONB — render with <pre>.`}</pre>

    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.vermillion, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 10 }}>
      GAPS / NEW WORK
    </div>
    <ul style={{ margin: 0, paddingLeft: 22, fontFamily: FONTS.serif, fontSize: 14, lineHeight: 1.7, color: C.ink, maxWidth: 760 }}>
      <li><strong>`ai_risk_summary`</strong> — column exists; detail drawer expects a short 1-3 sentence risk paragraph. Gate generation on <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>severity = 'red'</code> to control token cost.</li>
      <li><strong>Snooze</strong> — no table yet. Add <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>alert_recipients.snoozed_until timestamptz</code> or a dedicated <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>alert_snoozes</code> table. Filter in the list query.</li>
      <li><strong>CSV export</strong> — server endpoint that flattens the same SQL as the list query; stream to client.</li>
    </ul>
  </div>
);

// Minimal ProvTag (shared with dashboard; re-defined here to keep screens decoupled)
const ProvTag = ({ C, sql, fields, note, small }) => (
  <div style={{
    marginTop: 10, padding: small ? "6px 8px" : "8px 12px",
    background: "rgba(143, 181, 224, 0.08)", borderLeft: `2px solid ${C.ai}`,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: small ? 10 : 11, lineHeight: 1.5, color: C.ai, maxWidth: 720,
  }}>
    {sql && <div><span style={{ color: C.aiDeep, fontWeight: 600 }}>SQL </span>{sql}</div>}
    {fields && <div><span style={{ color: C.aiDeep, fontWeight: 600 }}>FIELDS </span>{fields}</div>}
    {note && <div style={{ marginTop: 4, fontStyle: "italic", color: C.inkDim }}>{note}</div>}
  </div>
);

// ── helpers ───────────────────────────────────────────────
const timeOnly = (iso) => new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: false });
const fullTime = (iso) => new Date(iso).toLocaleString("en-NZ", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const formatNzbn = (n) => { const s = String(n); return `${s.slice(0,4)} ${s.slice(4,8)} ${s.slice(8)}`; };
const relTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff/60)}m ago`;
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
  return `${Math.round(diff/86400)}d ago`;
};

window.Alerts = Alerts;
