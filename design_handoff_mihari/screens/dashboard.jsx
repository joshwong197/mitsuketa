/* Mihari — Dashboard (v2, prod-mapped)
 *
 * Every displayed value is traced to a real source. Annotations panel (toggle
 * top-right) overlays the provenance so the engineer can see what their
 * backend needs to supply. No sweep noise, no fabricated registrar counts.
 *
 * Source surface:
 *   - alerts            → alerts.*
 *   - alert_recipients  → is_read, read_at, created_at per user
 *   - entities          → entity_name, nzbn, entity_status, last_checked_at
 *   - watchlist_items   → count, recipient_emails, alert_toggles
 *   - monitoring_runs   → last completed_at, alerts_generated
 *   - profiles          → subscription_tier (trial banner)
 */

const Dashboard = ({ theme }) => {
  const { C } = theme;
  const [showProv, setShowProv] = React.useState(false);

  // ── DEMO DATA (shape matches prod schema) ─────────────────
  const lastRun = {
    started_at: "2026-01-13T05:55:00+13:00",
    completed_at: "2026-01-13T06:04:12+13:00",
    entities_checked: 42,
    alerts_generated: 7,
    status: "completed",
  };

  const user = { name: "Josh", subscription_tier: "pro", trial_ends: null };

  // alerts joined through alert_recipients (is_read filter)
  const alerts = [
    {
      id: "a1",
      alert_type: "company_insolvency",
      severity: "red",
      title: "Liquidator appointed",
      description: "Voluntary liquidation filed by the sole director. First creditors' meeting scheduled within 10 working days under s243 Companies Act.",
      ai_risk_summary: "Immediate exposure on any outstanding invoices. Debt likely unrecoverable without secured interest.",
      source: "Insolvency Register",
      created_at: "2026-01-13T07:12:00+13:00",
      is_read: false,
      entity: { entity_name: "Kōwhai Logistics Ltd", nzbn: "9429044031210", entity_status: "In Liquidation" },
      new_value: { liquidator: "Waterstone Insolvency", appointed_on: "2026-01-12" },
    },
    {
      id: "a2",
      alert_type: "gazette_notice",
      severity: "red",
      title: "Statutory demand — s289",
      description: "Demand for $84,220 served. 15 working days to comply before creditor can apply to liquidate.",
      ai_risk_summary: "Serious cashflow signal. Entity has 10 working days to pay, dispute, or arrange. Review outstanding balance urgently.",
      source: "NZ Gazette",
      created_at: "2026-01-13T02:15:00+13:00",
      is_read: false,
      entity: { entity_name: "Parnell Craft Coffee Ltd", nzbn: "9429050138844", entity_status: "Registered" },
    },
    {
      id: "a3",
      alert_type: "director_change",
      severity: "amber",
      title: "Director resigned",
      description: "Hana Whitiora ceased as director. 2 of 3 remaining; no replacement filed.",
      source: "Companies Office",
      created_at: "2026-01-13T06:48:00+13:00",
      is_read: false,
      entity: { entity_name: "Harbourline Freight Ltd", nzbn: "9429031180944", entity_status: "Registered" },
    },
    {
      id: "a4",
      alert_type: "address_change",
      severity: "amber",
      title: "Registered office changed",
      description: "Moved to a residential unit in Papatoetoe. Previous address was commercial premises.",
      source: "Companies Office",
      created_at: "2026-01-13T04:22:00+13:00",
      is_read: true,
      entity: { entity_name: "Mānuka & Sons Builders Ltd", nzbn: "9429041755028", entity_status: "Registered" },
    },
    {
      id: "a5",
      alert_type: "filing_compliance",
      severity: "green",
      title: "Annual return filed",
      source: "Companies Office",
      created_at: "2026-01-13T05:30:00+13:00",
      is_read: true,
      entity: { entity_name: "Tāwhiri Analytics Ltd", nzbn: "9429048822115", entity_status: "Registered" },
    },
  ];

  // aggregates — all derivable from alerts + alert_recipients
  const stats = {
    watchlist_count: 42,
    unread_count: alerts.filter(a => !a.is_read).length,
    severity_7d: { red: 2, amber: 6, green: 34 },
    pulse_14d: [3,5,2,7,4,6,3,8,5,4,9,6,7,5],
  };

  const redAlerts = alerts.filter(a => a.severity === "red" && !a.is_read);
  const restAlerts = alerts.filter(a => !(a.severity === "red" && !a.is_read));

  const today = new Date(lastRun.completed_at);
  const dateStr = today.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  return (
    <main style={{
      padding: "56px 64px 120px",
      maxWidth: 1440, margin: "0 auto", width: "100%",
      fontFamily: FONTS.serif, position: "relative",
    }}>
      {/* ─── Masthead ─────────────────────────────────────── */}
      <header style={{ marginBottom: 56 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 40, marginBottom: 24 }}>
          <Label num="I" jp="今日" C={C}>Today's watch</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <button onClick={() => setShowProv(!showProv)} style={{
              background: showProv ? C.ai : "none", color: showProv ? C.bg : C.ai,
              border: `1px solid ${C.ai}`, padding: "5px 12px",
              fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
              cursor: "pointer",
            }}>{showProv ? "HIDE" : "SHOW"} DATA SOURCES</button>
            <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.04em" }}>
              {dateStr} · AUCKLAND
            </div>
          </div>
        </div>
        <h1 style={{
          fontFamily: FONTS.serif, fontWeight: 400, fontSize: 68, lineHeight: 1.04,
          letterSpacing: "-0.02em", color: C.ink, margin: 0, maxWidth: 920,
        }}>
          {stats.unread_count === 0 ? (
            <>Nothing new on {stats.watchlist_count} entities<span style={{ color: C.green }}>.</span></>
          ) : (
            <>{numWord(stats.unread_count)} unread {stats.unread_count === 1 ? "change" : "changes"} on {stats.watchlist_count} entities<span style={{ color: C.vermillion }}>.</span></>
          )}
          {redAlerts.length > 0 && (
            <span style={{ color: C.inkDim, display: "block", fontSize: 32, marginTop: 14, letterSpacing: "-0.01em" }}>
              {numWord(redAlerts.length, true)} {redAlerts.length === 1 ? "asks" : "ask"} for your attention <span style={{ fontStyle: "italic" }}>now</span>.
            </span>
          )}
        </h1>
        {showProv && <ProvTag C={C} sql="SELECT count(*) FROM alert_recipients WHERE user_id = $1 AND is_read = false · COUNT watchlist_items WHERE user_id = $1 AND is_active = true" />}
      </header>

      {/* ─── Body grid ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 80 }}>
        <section>
          {/* Requires attention */}
          {redAlerts.length > 0 && (
            <div style={{ borderTop: `2px solid ${C.vermillion}`, paddingTop: 20, marginBottom: 44 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 20, color: C.vermillion, fontWeight: 600 }}>紅</span>
                  <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 22, color: C.ink }}>Requires attention</span>
                  <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.1em" }}>
                    — {redAlerts.length} UNREAD · SEVERITY RED
                  </span>
                </div>
                <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 500, cursor: "pointer" }}>Mark all read →</span>
              </div>
              {showProv && <ProvTag C={C} sql="alerts JOIN alert_recipients ON ... WHERE severity = 'red' AND is_read = false AND created_at > now() - interval '48 hours'" note="Shown above quiet list. Ordered by created_at DESC." />}

              {redAlerts.map((a, i, arr) => (
                <article key={a.id} style={{
                  display: "grid", gridTemplateColumns: "72px 1fr auto",
                  gap: 28, padding: "24px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.rule}` : "none",
                }}>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, paddingTop: 6, letterSpacing: "0.05em" }}>
                    {timeOnly(a.created_at)}
                  </div>
                  <div>
                    <h3 style={{
                      fontFamily: FONTS.serif, fontWeight: 500, fontSize: 28, lineHeight: 1.15,
                      letterSpacing: "-0.01em", color: C.ink, margin: 0, marginBottom: 6,
                    }}>{a.title}<span style={{ color: C.vermillion }}>.</span></h3>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.inkDim, marginBottom: 14 }}>
                      <span style={{ color: C.ink, fontStyle: "italic" }}>{a.entity.entity_name}</span>
                      <span style={{ color: C.inkFaint }}> · NZBN {formatNzbn(a.entity.nzbn)}</span>
                    </div>
                    {a.description && (
                      <p style={{
                        fontFamily: FONTS.serif, fontSize: 16, lineHeight: 1.55, color: C.ink,
                        margin: 0, marginBottom: a.ai_risk_summary ? 10 : 14, maxWidth: 620, textWrap: "pretty",
                      }}>{a.description}</p>
                    )}
                    {a.ai_risk_summary && (
                      <div style={{
                        marginBottom: 14, maxWidth: 620, paddingLeft: 14,
                        borderLeft: `2px solid ${C.aiDeep}`,
                      }}>
                        <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.ai, fontWeight: 500, letterSpacing: "0.08em", marginBottom: 4 }}>AI RISK SUMMARY</div>
                        <p style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 15, lineHeight: 1.5, color: C.inkDim, margin: 0 }}>
                          {a.ai_risk_summary}
                        </p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>
                      <span style={{ color: C.inkDim }}>SOURCE · {a.source.toUpperCase()}</span>
                      <span style={{ color: C.inkFaint }}>│</span>
                      <span style={{ color: C.ai, cursor: "pointer" }}>Open entity →</span>
                      <span style={{ color: C.ai, cursor: "pointer" }}>Mark read</span>
                      <span style={{ color: C.inkDim, cursor: "pointer" }}>Snooze 24h</span>
                    </div>
                    {showProv && <ProvTag C={C} inline fields="alerts.title · alerts.description · alerts.ai_risk_summary · alerts.source · alerts.created_at · entities.entity_name · entities.nzbn" />}
                  </div>
                  <SevKanji sev={a.severity} size={32} C={C} />
                </article>
              ))}
            </div>
          )}

          {/* Rest */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
              <Label num="II" jp="其他" C={C}>Rest of today</Label>
              <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.1em", marginLeft: "auto" }}>
                {restAlerts.length} {restAlerts.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
            {showProv && <ProvTag C={C} sql="alerts JOIN alert_recipients WHERE created_at > date_trunc('day', now()) AND (severity != 'red' OR is_read = true) ORDER BY created_at DESC" />}
            {restAlerts.map((a, i) => (
              <article key={a.id} style={{
                display: "grid", gridTemplateColumns: "72px 28px 1fr auto",
                gap: 20, padding: "20px 0",
                borderBottom: `1px solid ${C.ruleSoft}`,
                alignItems: "start",
                opacity: a.is_read ? 0.65 : 1,
              }}>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, paddingTop: 4, letterSpacing: "0.05em" }}>
                  {timeOnly(a.created_at)}
                </div>
                <SevKanji sev={a.severity} size={22} C={C} />
                <div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em", marginBottom: 2 }}>
                    {a.title}
                    {!a.is_read && <span style={{ display: "inline-block", width: 6, height: 6, background: C.ai, marginLeft: 10, verticalAlign: "middle" }} />}
                  </div>
                  <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 15, color: C.inkDim }}>
                    {a.entity.entity_name}
                  </div>
                  {a.description && (
                    <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, marginTop: 6, maxWidth: 540 }}>
                      {a.description}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.04em", paddingTop: 6, textAlign: "right" }}>
                  {a.source.toUpperCase()}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ═══ Right rail ═══ */}
        <aside style={{ paddingTop: 4 }}>
          {/* Last sweep — real data only */}
          <div style={{ paddingBottom: 28, borderBottom: `1px solid ${C.rule}` }}>
            <Label num="i" jp="巡回" C={C}>Last sweep</Label>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: FONTS.serif, fontSize: 34, color: C.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {timeOnly(lastRun.completed_at)}
              </div>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, marginTop: 6, fontWeight: 500, letterSpacing: "0.04em" }}>
                COMPLETED · {runDuration(lastRun)} SECONDS
              </div>
            </div>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 28, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {lastRun.entities_checked}
                </div>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, marginTop: 4, fontWeight: 500, letterSpacing: "0.05em" }}>
                  ENTITIES CHECKED
                </div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 28, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {lastRun.alerts_generated}
                </div>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, marginTop: 4, fontWeight: 500, letterSpacing: "0.05em" }}>
                  ALERTS GENERATED
                </div>
              </div>
            </div>
            {showProv && <ProvTag C={C} small fields="monitoring_runs: started_at, completed_at, entities_checked, alerts_generated, status" />}
          </div>

          {/* Severity distribution */}
          <div style={{ paddingTop: 28, paddingBottom: 28, borderBottom: `1px solid ${C.rule}` }}>
            <Label num="ii" jp="名簿" C={C}>Watchlist pulse</Label>
            <div style={{ marginTop: 18 }}>
              {[
                { k: "紅", l: "Red — attention", v: stats.severity_7d.red, c: C.vermillion },
                { k: "琥", l: "Amber — watch",   v: stats.severity_7d.amber, c: C.amber },
                { k: "青", l: "Green — routine", v: stats.severity_7d.green, c: C.green },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "22px 1fr auto",
                  alignItems: "center", gap: 14, padding: "10px 0",
                }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 18, color: r.c, lineHeight: 1 }}>{r.k}</span>
                  <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.l}</span>
                  <span style={{ fontFamily: FONTS.serif, fontSize: 22, color: r.c, letterSpacing: "-0.02em" }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, letterSpacing: "0.05em", fontWeight: 500, marginBottom: 10 }}>
                14-DAY VOLUME
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
                {stats.pulse_14d.map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h * 10}%`,
                    background: h > 7 ? C.vermillion : h > 4 ? C.amber : C.ai,
                    opacity: i === stats.pulse_14d.length - 1 ? 1 : 0.7,
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500 }}>
                <span>30 DEC</span><span>TODAY</span>
              </div>
            </div>
            {showProv && <ProvTag C={C} small sql="GROUP BY severity, date_trunc('day', created_at) WHERE created_at > now() - interval '14 days'" />}
          </div>

          {/* Upcoming */}
          <div style={{ paddingTop: 28 }}>
            <Label num="iii" jp="諸元" C={C}>This week</Label>
            <div style={{ marginTop: 16 }}>
              {[
                { l: "Annual returns due", v: "3", sub: "derived from entities.last_known_snapshot" },
                { l: "Trial ending", v: user.trial_ends ? "4 days" : "—", sub: "profiles.subscription_tier" },
                { l: "CSV imports queued", v: "1", sub: "audit_log WHERE event_type = 'csv_upload'" },
              ].map((r, i) => (
                <div key={i} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${C.ruleSoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.l}</span>
                    <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 15, color: C.ai }}>{r.v}</span>
                  </div>
                  {showProv && (
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.ai, marginTop: 3, fontWeight: 500, letterSpacing: "0.02em" }}>
                      {r.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Provenance summary panel (bottom) ──────────────── */}
      {showProv && <ProvenancePanel C={C} lastRun={lastRun} />}

      {/* Footer colophon */}
      <footer style={{
        marginTop: 120, paddingTop: 24, borderTop: `1px solid ${C.rule}`,
        display: "flex", justifyContent: "space-between",
        fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.05em",
      }}>
        <span>MIHARI · 見張り · CREDIT MONITORING</span>
        <span>LAST SWEEP {timeOnly(lastRun.completed_at)} NZST</span>
      </footer>
    </main>
  );
};

// ── Helpers ────────────────────────────────────────────────
const numWord = (n, cap = false) => {
  const w = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
  const s = n < w.length ? w[n] : String(n);
  return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};
const timeOnly = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: false });
};
const runDuration = (r) => {
  if (!r.started_at || !r.completed_at) return "—";
  return Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 1000);
};
const formatNzbn = (n) => {
  const s = String(n);
  return `${s.slice(0,4)} ${s.slice(4,8)} ${s.slice(8)}`;
};

// ── Provenance tag (inline) ───────────────────────────────
const ProvTag = ({ C, sql, fields, note, inline, small }) => (
  <div style={{
    marginTop: inline ? 10 : 10,
    padding: small ? "6px 8px" : "8px 12px",
    background: "rgba(143, 181, 224, 0.08)",
    borderLeft: `2px solid ${C.ai}`,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: small ? 10 : 11, lineHeight: 1.5,
    color: C.ai,
    maxWidth: 680,
  }}>
    {sql && <div><span style={{ color: C.aiDeep, fontWeight: 600 }}>SQL </span>{sql}</div>}
    {fields && <div><span style={{ color: C.aiDeep, fontWeight: 600 }}>FIELDS </span>{fields}</div>}
    {note && <div style={{ marginTop: 4, fontStyle: "italic", color: C.inkDim }}>{note}</div>}
  </div>
);

// ── Provenance summary panel (bottom) ─────────────────────
const ProvenancePanel = ({ C, lastRun }) => {
  const tables = [
    { t: "profiles",          cols: "subscription_tier, email",                     where: "= auth.uid()", used: "Trial banner, user email" },
    { t: "entities",          cols: "entity_name, nzbn, entity_status, last_known_snapshot", where: "joined via watchlist_items", used: "Alert entity display, annual-return derivation" },
    { t: "watchlist_items",   cols: "entity_id, alert_toggles, is_active",          where: "user_id = auth.uid() AND is_active", used: "42-count, per-user alert filter" },
    { t: "alerts",            cols: "severity, title, description, ai_risk_summary, source, created_at", where: "joined via alert_recipients", used: "Every alert card above" },
    { t: "alert_recipients",  cols: "is_read, read_at, created_at",                 where: "user_id = auth.uid()", used: "Unread count, dimmed read rows, today filter" },
    { t: "monitoring_runs",   cols: "started_at, completed_at, entities_checked, alerts_generated, status", where: "ORDER BY started_at DESC LIMIT 1", used: "Last-sweep card, top-bar status" },
  ];

  const queries = [
    { name: "Unread red alerts (hero)", q: "SELECT a.* FROM alerts a JOIN alert_recipients r ON r.alert_id = a.id WHERE r.user_id = auth.uid() AND a.severity = 'red' AND r.is_read = false ORDER BY a.created_at DESC" },
    { name: "Today's alert feed",       q: "SELECT a.*, e.entity_name, e.nzbn FROM alerts a JOIN alert_recipients r ON r.alert_id = a.id JOIN entities e ON e.id = a.entity_id WHERE r.user_id = auth.uid() AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'Pacific/Auckland')" },
    { name: "14-day severity pulse",    q: "SELECT date_trunc('day', a.created_at) d, a.severity, count(*) FROM alerts a JOIN alert_recipients r ON r.alert_id = a.id WHERE r.user_id = auth.uid() AND a.created_at > now() - interval '14 days' GROUP BY 1,2" },
    { name: "Last sweep",               q: "SELECT * FROM monitoring_runs ORDER BY started_at DESC LIMIT 1" },
    { name: "Watchlist count",          q: "SELECT count(*) FROM watchlist_items WHERE user_id = auth.uid() AND is_active = true" },
  ];

  return (
    <div style={{
      marginTop: 80, padding: "40px 0 0",
      borderTop: `2px solid ${C.ai}`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 32 }}>
        <Label num="§" jp="出所" C={C} color={C.ai}>Data provenance</Label>
        <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 22, color: C.ink, letterSpacing: "-0.01em" }}>
          what this dashboard needs from your backend
        </span>
      </div>

      {/* Tables */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 14 }}>
          TABLES &amp; COLUMNS
        </div>
        <div style={{ border: `1px solid ${C.rule}` }}>
          <div style={{
            display: "grid", gridTemplateColumns: "180px 1.4fr 0.9fr 1.1fr",
            padding: "10px 16px", borderBottom: `1px solid ${C.rule}`, background: C.panel,
            fontFamily: FONTS.gothic, fontSize: 10, fontWeight: 600, color: C.inkDim, letterSpacing: "0.08em",
          }}>
            <span>TABLE</span><span>COLUMNS</span><span>WHERE</span><span>USED FOR</span>
          </div>
          {tables.map((r, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "180px 1.4fr 0.9fr 1.1fr",
              padding: "14px 16px", borderBottom: i < tables.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              fontSize: 12, lineHeight: 1.55,
            }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai, fontWeight: 600 }}>{r.t}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ink, fontSize: 11 }}>{r.cols}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: C.inkDim, fontSize: 11 }}>{r.where}</span>
              <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.used}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Queries */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 14 }}>
          QUERIES THE DASHBOARD EXECUTES ON LOAD
        </div>
        {queries.map((q, i) => (
          <div key={i} style={{
            padding: "16px 0",
            borderTop: `1px solid ${C.ruleSoft}`,
          }}>
            <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.ink, marginBottom: 8, letterSpacing: "-0.005em" }}>
              {q.name}
            </div>
            <pre style={{
              margin: 0, padding: "10px 14px", background: C.panel, border: `1px solid ${C.ruleSoft}`,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, lineHeight: 1.6,
              color: C.ink, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{q.q}</pre>
          </div>
        ))}
      </div>

      {/* Cron / engine */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 14 }}>
          BACKEND OBLIGATIONS (monitoring engine)
        </div>
        <ol style={{
          margin: 0, paddingLeft: 24,
          fontFamily: FONTS.serif, fontSize: 15, lineHeight: 1.7, color: C.ink, maxWidth: 760,
        }}>
          <li>
            Cron calls <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>src/lib/monitoring/engine.ts</code> on a schedule (e.g. every 4h). It inserts a <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>monitoring_runs</code> row, iterates every active watchlist entity, and updates <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>entities.last_checked_at</code>.
          </li>
          <li>
            Per-entity: fetch fresh snapshot (NZBN + Companies Office + Insolvency + Gazette + Disqualified Directors), diff against <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>entities.last_known_snapshot</code>, emit <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>alerts</code> rows for any toggled-on change (see <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>watchlist_items.alert_toggles</code>).
          </li>
          <li>
            For each new alert, fan out <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>alert_recipients</code> rows to every user watching that entity; queue emails to <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>recipient_emails</code>.
          </li>
          <li>
            Optional but displayed: populate <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>alerts.ai_risk_summary</code> (1-2 sentences). The dashboard renders it under red alerts only — amber/green hide the field.
          </li>
          <li>
            Write <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>completed_at</code>, <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>entities_checked</code>, <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.ai }}>alerts_generated</code> on the monitoring_runs row.
          </li>
        </ol>
      </div>

      {/* Gaps */}
      <div>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.vermillion, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 14 }}>
          GAPS / NEW WORK
        </div>
        <ul style={{
          margin: 0, paddingLeft: 24,
          fontFamily: FONTS.serif, fontSize: 15, lineHeight: 1.7, color: C.ink, maxWidth: 760,
        }}>
          <li><strong>Annual returns due</strong> — derive from <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>entities.last_known_snapshot.annualReturnFilingMonth</code>. A nightly job or a view would be cleanest.</li>
          <li><strong>CSV imports queued</strong> — currently not tracked; add a <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>csv_uploads</code> table (status: pending/processing/done/failed, rowcount, user_id) or log via audit_log.</li>
          <li><strong>Trial days remaining</strong> — add <code style={{ fontFamily: '"JetBrains Mono", monospace', color: C.vermillion }}>profiles.trial_ends_at</code> (nullable timestamptz) and compute on the client.</li>
          <li><strong>AI risk summary</strong> — column exists, but needs an actual generation step in the alerter. Gate on severity = 'red' to keep token cost down.</li>
        </ul>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
