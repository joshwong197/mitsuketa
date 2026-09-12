/* Mihari — Email & alert preferences (設定 · the dials)
 *
 * Where the user wires WHO gets alerts and WHICH triggers fire.
 * Sections:
 *   1. Recipients — email addresses + per-recipient routing rules
 *   2. Triggers  — the 14 alert_toggles categories, each with numbered triggers
 *   3. Delivery  — digest vs real-time, quiet hours, timezone
 *   4. Preview   — cool-stone email template rendering
 */

const RECIPIENTS = [
  { id: "r1", email: "josh@mihari.nz",      label: "Primary · me",         primary: true,  verified: true,  severities: ["red","amber","green"], lists: ["all"],                          digest: "realtime",     addedOn: "2024-09-03" },
  { id: "r2", email: "ap@mihari.nz",        label: "Accounts payable",     primary: false, verified: true,  severities: ["red","amber"],         lists: ["trade_credit"],                 digest: "daily_09",     addedOn: "2024-11-10" },
  { id: "r3", email: "credit@mihari.nz",    label: "Credit committee",     primary: false, verified: true,  severities: ["red"],                 lists: ["loan_portfolio","watch_closely"], digest: "realtime",     addedOn: "2025-02-14" },
  { id: "r4", email: "legal@mihari.nz",     label: "Legal · gazette only", primary: false, verified: false, severities: ["red"],                 lists: ["all"],                          digest: "weekly_mon_08", addedOn: "2026-01-05" },
];

const TOGGLE_CATS = [
  { key: "entity_status_change", label: "Status changes",         jp: "状態", sev: "red",   n: 1, triggers: ["#1 Entity struck off", "#2 Restored", "#3 Removed"] },
  { key: "company_insolvency",   label: "Company insolvency",     jp: "破産", sev: "red",   n: 8, triggers: ["#13 Liquidator appointed", "#14 Receiver appointed", "#15 VA commenced", "#16 Winding up application", "#17 Court liquidation", "#18 Statutory manager", "#19 Deed of company arrangement", "#20 Creditors' compromise"] },
  { key: "personal_insolvency",  label: "Personal insolvency",    jp: "個人", sev: "red",   n: 6, triggers: ["#21 Director bankruptcy", "#22 NAP", "#23 Discharge"] },
  { key: "director_change",      label: "Director changes",       jp: "役員", sev: "amber", n: 1, triggers: ["#26 Director ceased", "#27 Director appointed"] },
  { key: "officer_role_change",  label: "Officer role changes",   jp: "職員", sev: "amber", n: 8, triggers: ["#31 Partner added", "#32 Trustee changed"] },
  { key: "shareholder_change",   label: "Shareholder changes",    jp: "株主", sev: "amber", n: 3, triggers: ["#41 Shareholding restructure", "#42 UHC changed", "#43 Beneficial owner listed"] },
  { key: "name_change",          label: "Name changes",           jp: "名義", sev: "amber", n: 2, triggers: ["#30 Entity renamed", "#33 Trading name"] },
  { key: "address_change",       label: "Address changes",        jp: "住所", sev: "amber", n: 8, triggers: ["#5 Registered office", "#12 Service address", "#8 Postal address"] },
  { key: "gazette_notice",       label: "Gazette notices",        jp: "官報", sev: "red",   n: 5, triggers: ["#71 Statutory demand · s289", "#79 Winding up notice", "#80 Creditors' meeting"] },
  { key: "filing_compliance",    label: "Filing & compliance",    jp: "届出", sev: "green", n: 6, triggers: ["#20 Annual return filed", "#25 Financials filed", "#28 Overdue"] },
  { key: "contact_change",       label: "Contact changes",        jp: "連絡", sev: "green", n: 4, triggers: ["#50 Phone", "#51 Email", "#52 Website"] },
  { key: "business_profile",     label: "Business profile",       jp: "業種", sev: "green", n: 9, triggers: ["#55 ANZSIC", "#56 Trading area", "#57 GST"] },
  { key: "disqualified_director",label: "Disqualified directors", jp: "失格", sev: "red",   n: 1, triggers: ["#60 Director appears on disq. list"] },
  { key: "cross_entity_risk",    label: "Cross-entity risk",      jp: "関連", sev: "amber", n: 3, triggers: ["#65 Director linked to distress", "#66 Shared address w/ distressed", "#67 Same postcode cluster"] },
];

const Preferences = ({ theme }) => {
  const { C } = theme;
  const [tab, setTab] = React.useState("recipients");
  const [toggles, setToggles] = React.useState(
    Object.fromEntries(TOGGLE_CATS.map(c => [c.key, c.sev !== "green"]))
  );
  const [expanded, setExpanded] = React.useState(new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [digestMode, setDigestMode] = React.useState("realtime_red_daily_others");
  const [quietFrom, setQuietFrom] = React.useState("20:00");
  const [quietTo, setQuietTo] = React.useState("07:00");

  const toggleCat = (k) => setToggles(t => ({ ...t, [k]: !t[k] }));
  const toggleExp = (k) => { const n = new Set(expanded); n.has(k) ? n.delete(k) : n.add(k); setExpanded(n); };

  const onCount  = Object.values(toggles).filter(Boolean).length;
  const offCount = TOGGLE_CATS.length - onCount;

  return (
    <main style={{ padding: "48px 56px 100px", color: C.ink, fontFamily: FONTS.serif }}>
      {/* Masthead */}
      <div style={{ marginBottom: 34 }}>
        <Label num="vii." jp="設定" C={C}>Preferences</Label>
        <h1 style={{
          fontFamily: FONTS.serif, fontSize: 68, fontWeight: 300, lineHeight: 1.04,
          letterSpacing: "-0.03em", margin: "14px 0 0", color: C.ink,
        }}>
          Who gets told,
          <em style={{ fontWeight: 300, color: C.inkDim }}> and about what.</em>
        </h1>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, marginTop: 14, display: "flex", gap: 22 }}>
          <span>{RECIPIENTS.length} recipients · {RECIPIENTS.filter(r => !r.verified).length} pending verification</span>
          <span style={{ color: C.inkFaint }}>│</span>
          <span>{onCount} of {TOGGLE_CATS.length} trigger categories on</span>
        </div>
      </div>

      {/* Tab rail */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.rule}`, marginBottom: 40 }}>
        {[
          { id: "recipients", jp: "宛先", label: "Recipients", count: RECIPIENTS.length },
          { id: "triggers",   jp: "警報", label: "Triggers",   count: `${onCount}/${TOGGLE_CATS.length}` },
          { id: "delivery",   jp: "配信", label: "Delivery",   count: null },
          { id: "preview",    jp: "見本", label: "Preview",    count: null },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none",
              borderBottom: `2px solid ${on ? C.vermillion : "transparent"}`,
              marginBottom: -1, padding: "16px 22px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color: on ? C.vermillion : C.inkFaint, letterSpacing: "0.2em" }}>{t.jp}</span>
              <span style={{ fontFamily: FONTS.serif, fontSize: 18, color: on ? C.ink : C.inkDim, letterSpacing: "-0.01em" }}>{t.label}</span>
              {t.count != null && <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>· {t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── RECIPIENTS ──────────────────────────────────── */}
      {tab === "recipients" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, gap: 20, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 720 }}>
              <h2 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>Default recipients.</h2>
              <p style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, margin: "10px 0 0", lineHeight: 1.55 }}>
                New entities inherit this list. Any entity on your Watchlist can override these defaults — add a credit officer for one borrower, route gazette notices on a specific company to legal, mute a noisy one entirely. The primary address always hears everything.
              </p>
            </div>
            <button onClick={() => setAddOpen(true)} style={{
              background: C.ink, color: C.bg, border: `1px solid ${C.ink}`,
              fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "11px 22px", cursor: "pointer",
            }}>＋ Add recipient</button>
          </div>

          {/* Override summary strip */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            padding: "14px 20px", border: `1px solid ${C.ruleSoft}`, borderLeft: `3px solid ${C.vermillion}`,
            background: C.panel, marginBottom: 22,
          }}>
            <span style={{ fontFamily: FONTS.mincho, fontSize: 14, color: C.vermillion, letterSpacing: "0.2em" }}>例外</span>
            <span style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink }}>
              <strong style={{ fontWeight: 500 }}>3 entities</strong> currently override these defaults
            </span>
            <span style={{ color: C.inkFaint }}>·</span>
            <span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500 }}>Kōwhai Logistics · South Central Build · Parnell Craft Coffee</span>
            <span style={{ flex: 1 }} />
            <a href="#" style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ai, textDecoration: "none", fontWeight: 500 }}>Manage on watchlist →</a>
          </div>

          <div style={{ border: `1px solid ${C.rule}`, background: C.bg }}>
            <div style={{
              display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.2fr) 160px 80px",
              borderBottom: `1px solid ${C.rule}`,
              fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              <div style={{ padding: "14px 20px" }}>Address</div>
              <div style={{ padding: "14px 0" }}>Severity</div>
              <div style={{ padding: "14px 0" }}>Default scope</div>
              <div style={{ padding: "14px 0" }}>Cadence</div>
              <div style={{ padding: "14px 20px 14px 0", textAlign: "right" }}></div>
            </div>
            {RECIPIENTS.map((r, i) => (
              <div key={r.id} style={{
                display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.2fr) 160px 80px",
                alignItems: "center",
                borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
              }}>
                <div style={{ padding: "22px 20px" }}>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 10 }}>
                    {r.email}
                    {r.primary && <span style={{ fontFamily: FONTS.gothic, fontSize: 10, fontWeight: 600, background: C.ai, color: C.bg, padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase" }}>primary</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 5 }}>
                    <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500 }}>{r.label}</span>
                    <span style={{ color: C.inkFaint }}>·</span>
                    {r.verified ? (
                      <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.green, fontWeight: 500 }}>● verified</span>
                    ) : (
                      <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.amber, fontWeight: 500 }}>● pending · resend ↗</span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "22px 0", display: "flex", gap: 6 }}>
                  {["red","amber","green"].map(s => (
                    <div key={s} style={{
                      width: 22, height: 22,
                      background: r.severities.includes(s) ? ({red:C.vermillion,amber:C.amber,green:C.green}[s]) : "transparent",
                      border: r.severities.includes(s) ? "none" : `1px solid ${C.rule}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONTS.mincho, fontSize: 12, fontWeight: 700,
                      color: r.severities.includes(s) ? C.bg : C.inkFaint,
                    }}>{({red:"紅",amber:"琥",green:"青"}[s])}</div>
                  ))}
                </div>
                <div style={{ padding: "22px 16px 22px 0" }}>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink }}>
                    {r.lists.includes("all") ? "All entities" : `${r.lists.length} list${r.lists.length === 1 ? "" : "s"}`}
                  </div>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 3 }}>
                    Overridden on {r.id === "r1" ? "3 entities" : r.id === "r3" ? "1 entity" : "0 entities"}
                  </div>
                </div>
                <div style={{ padding: "22px 0", fontFamily: FONTS.gothic, fontSize: 12, color: C.ai, fontWeight: 500 }}>
                  {({ realtime: "Real-time", daily_09: "Daily · 09:00", weekly_mon_08: "Weekly · Mon 08:00" }[r.digest])}
                </div>
                <div style={{ padding: "22px 20px 22px 0", textAlign: "right" }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500 }}>Edit →</button>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.6, marginTop: 18, maxWidth: 720 }}>
            These are the <em>defaults</em> that every new entity inherits. Per-entity overrides live on the Watchlist row expand and on each entity's detail page — so you can route a single distressed borrower to the credit committee without changing the rule for anyone else.
          </p>

          {addOpen && <AddRecipientSheet C={C} onClose={() => setAddOpen(false)} />}
        </section>
      )}

      {/* ── TRIGGERS ────────────────────────────────────── */}
      {tab === "triggers" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
            <div style={{ maxWidth: 680 }}>
              <h2 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>Which triggers fire.</h2>
              <p style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, margin: "10px 0 0", lineHeight: 1.55 }}>
                Global defaults. Applies to every entity on your watchlist. Per-entity overrides live on the entity page.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500 }}>
              <button style={{ background: "none", border: `1px solid ${C.rule}`, color: C.ink, padding: "9px 14px", cursor: "pointer" }}>Turn all on</button>
              <button style={{ background: "none", border: `1px solid ${C.rule}`, color: C.ink, padding: "9px 14px", cursor: "pointer" }}>Red-only</button>
              <button style={{ background: "none", border: `1px solid ${C.rule}`, color: C.inkDim, padding: "9px 14px", cursor: "pointer" }}>Turn all off</button>
            </div>
          </div>

          <div style={{ border: `1px solid ${C.rule}`, background: C.bg }}>
            {TOGGLE_CATS.map((c, i) => {
              const on = toggles[c.key];
              const isExp = expanded.has(c.key);
              return (
                <div key={c.key} style={{ borderTop: i > 0 ? `1px solid ${C.ruleSoft}` : "none" }}>
                  <div onClick={() => toggleExp(c.key)} style={{
                    display: "grid", gridTemplateColumns: "48px minmax(0,1fr) 100px 120px 40px",
                    alignItems: "center", padding: "18px 22px", cursor: "pointer",
                    opacity: on ? 1 : 0.55,
                  }}>
                    <SevKanji sev={c.sev} size={26} C={C} />
                    <div style={{ padding: "0 16px 0 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: FONTS.mincho, fontSize: 13, color: C.inkDim, letterSpacing: "0.2em" }}>{c.jp}</span>
                        <span style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em" }}>{c.label}</span>
                      </div>
                      <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 4 }}>
                        {c.triggers.length} trigger{c.triggers.length === 1 ? "" : "s"} · {c.n} fired in the last 30 days
                      </div>
                    </div>
                    <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: on ? C.ai : C.inkFaint, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {on ? "● on" : "○ off"}
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); toggleCat(c.key); }}>
                      <SquareToggle on={on} C={C} />
                    </div>
                    <div style={{ textAlign: "right", fontFamily: FONTS.gothic, fontSize: 14, color: C.inkDim }}>{isExp ? "−" : "+"}</div>
                  </div>
                  {isExp && (
                    <div style={{ padding: "4px 22px 22px 80px", background: C.panel, borderTop: `1px solid ${C.ruleSoft}` }}>
                      <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkDim, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", padding: "14px 0 10px" }}>Individual triggers</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px 24px" }}>
                        {c.triggers.map((t, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                            <div style={{ width: 14, height: 14, background: on ? C.vermillion : "transparent", border: on ? "none" : `1px solid ${C.rule}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {on && <div style={{ width: 7, height: 7, background: C.bg }} />}
                            </div>
                            <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.6, marginTop: 18, maxWidth: 680 }}>
            Mutes apply on top of these toggles. A muted entity will not email anyone, even for Red triggers.
          </p>
        </section>
      )}

      {/* ── DELIVERY ────────────────────────────────────── */}
      {tab === "delivery" && (
        <section>
          <h2 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>How fast, and when.</h2>
          <p style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, margin: "10px 0 28px", lineHeight: 1.55, maxWidth: 680 }}>
            Control when the watchman speaks. Quiet hours hold Amber and Green alerts until morning; Red always delivers.
          </p>

          <div style={{ border: `1px solid ${C.rule}`, background: C.bg, padding: 0 }}>
            <div style={{ padding: "28px 28px", borderBottom: `1px solid ${C.ruleSoft}` }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Cadence default</div>
              {[
                { id: "realtime",                   title: "Real-time",                      sub: "Every alert sent within 15 minutes of detection." },
                { id: "realtime_red_daily_others",  title: "Red real-time · others daily",   sub: "Insolvency & gazette urgent; everything else batched at 09:00." },
                { id: "daily",                      title: "Daily digest",                   sub: "One email at 09:00 NZST with everything from the prior 24h." },
                { id: "weekly",                     title: "Weekly digest",                  sub: "Monday 08:00. Best for quiet portfolios." },
              ].map(o => {
                const on = digestMode === o.id;
                return (
                  <label key={o.id} style={{
                    display: "grid", gridTemplateColumns: "22px 1fr", gap: 14, alignItems: "start",
                    padding: "12px 0", cursor: "pointer",
                  }}>
                    <input type="radio" checked={on} onChange={() => setDigestMode(o.id)} style={{ marginTop: 6, accentColor: C.vermillion }} />
                    <div>
                      <div style={{ fontFamily: FONTS.serif, fontSize: 18, color: C.ink, letterSpacing: "-0.005em" }}>{o.title}</div>
                      <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, marginTop: 3, lineHeight: 1.5 }}>{o.sub}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ padding: "28px 28px", borderBottom: `1px solid ${C.ruleSoft}` }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Quiet hours</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.ink }}>Hold non-Red alerts from</div>
                <input value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, background: "transparent", border: `1px solid ${C.rule}`, padding: "8px 12px", width: 110, outline: "none", textAlign: "center" }} />
                <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.ink }}>until</div>
                <input value={quietTo}   onChange={(e) => setQuietTo(e.target.value)}   style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink, background: "transparent", border: `1px solid ${C.rule}`, padding: "8px 12px", width: 110, outline: "none", textAlign: "center" }} />
                <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500 }}>NZST · Pacific/Auckland</div>
              </div>
              <p style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.6, marginTop: 14, maxWidth: 620 }}>
                Red alerts override quiet hours. Everything else is queued and sent at the end of the quiet window.
              </p>
            </div>

            <div style={{ padding: "28px 28px" }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Channels</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {[
                  { label: "Email",   sub: "Always on · cannot be disabled",             on: true,  lock: true  },
                  { label: "Webhook", sub: "POST to a URL for ingestion · Ledger plan",  on: false, lock: false },
                  { label: "Slack",   sub: "Channel delivery · coming Q3 2026",          on: false, lock: true  },
                ].map(ch => (
                  <div key={ch.label} style={{
                    border: `1px solid ${C.rule}`, padding: "16px 18px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
                    opacity: ch.lock && !ch.on ? 0.55 : 1,
                  }}>
                    <div>
                      <div style={{ fontFamily: FONTS.serif, fontSize: 18, color: C.ink, letterSpacing: "-0.005em" }}>{ch.label}</div>
                      <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 3 }}>{ch.sub}</div>
                    </div>
                    <SquareToggle on={ch.on} C={C} locked={ch.lock} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── PREVIEW ─────────────────────────────────────── */}
      {tab === "preview" && (
        <section>
          <h2 style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>What the email looks like.</h2>
          <p style={{ fontFamily: FONTS.serif, fontSize: 16, color: C.inkDim, margin: "10px 0 28px", lineHeight: 1.55, maxWidth: 680 }}>
            Cool stone only. 560px wide. Hanko seal, severity kanji, plain serif body. A single ai-blue "Open in Mihari" link.
          </p>

          <div style={{
            border: `1px solid ${C.rule}`, padding: 40, background: C.panel,
            display: "flex", justifyContent: "center",
          }}>
            <EmailSample />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button style={{ background: C.ink, color: C.bg, border: `1px solid ${C.ink}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "11px 18px", cursor: "pointer" }}>Send test to josh@mihari.nz</button>
            <button style={{ background: "none", color: C.ink, border: `1px solid ${C.rule}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "11px 18px", cursor: "pointer" }}>View HTML source</button>
          </div>
        </section>
      )}
    </main>
  );
};

// ── Helpers ─────────────────────────────────────────────
const SquareToggle = ({ on, C, locked }) => (
  <div style={{
    width: 48, height: 24, background: on ? C.vermillion : C.panel2,
    border: `1px solid ${on ? C.vermillion : C.rule}`,
    position: "relative", cursor: locked ? "not-allowed" : "pointer", flexShrink: 0,
    opacity: locked ? 0.7 : 1,
  }}>
    <div style={{
      position: "absolute", top: 2, left: on ? 26 : 2,
      width: 18, height: 18, background: on ? "#fff" : C.ink,
      transition: "left 120ms",
    }} />
  </div>
);

const AddRecipientSheet = ({ C, onClose }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: "100vw", height: "100vh", background: C.bg, borderLeft: `1px solid ${C.rule}`, padding: 36, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Label num="＋" jp="宛先" C={C}>Add recipient</Label>
          <h2 style={{ fontFamily: FONTS.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em", margin: "10px 0 0", color: C.ink }}>A new email to route.</h2>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.inkDim, fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>
      <label style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Email address</label>
      <input autoFocus placeholder="name@yourorg.co.nz" style={{ background: C.panel, border: `1px solid ${C.rule}`, padding: "12px 16px", fontFamily: FONTS.serif, fontSize: 18, color: C.ink, outline: "none" }} />
      <label style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Label</label>
      <input placeholder="Accounts payable" style={{ background: C.panel, border: `1px solid ${C.rule}`, padding: "12px 16px", fontFamily: FONTS.serif, fontSize: 16, color: C.ink, outline: "none" }} />
      <label style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Receive which severities</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["red","amber","green"].map(s => (
          <button key={s} style={{ flex: 1, padding: "10px 12px", background: s === "red" ? C.vermillion : s === "amber" ? C.amber : C.panel, color: s === "green" ? C.ink : C.bg, border: "none", fontFamily: FONTS.mincho, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{s === "red" ? "紅 Red" : s === "amber" ? "琥 Amber" : "青 Green"}</button>
        ))}
      </div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 14, fontStyle: "italic", color: C.inkDim, marginTop: 6 }}>
        We'll send a verification email. Alerts begin once the link is clicked.
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ flex: 1, background: C.ink, color: C.bg, border: `1px solid ${C.ink}`, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, padding: "13px", cursor: "pointer" }}>Send verification</button>
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.rule}`, color: C.inkDim, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500, padding: "13px 18px", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  </div>
);

const EmailSample = () => (
  <div style={{
    width: 560, background: "#eceeef", color: "#14161a", fontFamily: FONTS.serif,
    border: "1px solid #c6c9ce",
  }}>
    <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #c6c9ce", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 32, height: 32, background: "#b82f21", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mincho, fontSize: 20, fontWeight: 800, color: "#eceeef" }}>見</div>
      <div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 17, letterSpacing: "-0.01em" }}>Mihari</div>
        <div style={{ fontFamily: FONTS.mincho, fontSize: 10, color: "#5e6168", letterSpacing: "0.3em", marginTop: 2 }}>見張り</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: "#5e6168", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Mon 13 Jan · 07:12</div>
    </div>
    <div style={{ padding: "28px 26px 12px", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ width: 36, height: 36, background: "#b82f21", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mincho, fontSize: 20, fontWeight: 700, color: "#eceeef", flexShrink: 0 }}>紅</div>
      <div>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: "#5e6168", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Company insolvency · trigger #13</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", margin: "6px 0 4px", lineHeight: 1.2 }}>Liquidator appointed.</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: "#5e6168", letterSpacing: "-0.005em" }}>Kōwhai Logistics Ltd · NZBN 9429044031210</div>
      </div>
    </div>
    <div style={{ padding: "8px 26px 20px" }}>
      <p style={{ fontFamily: FONTS.serif, fontSize: 15, color: "#14161a", lineHeight: 1.6, margin: "14px 0 0" }}>
        Voluntary liquidation filed by the sole director. First creditors' meeting scheduled within 10 working days under s243 Companies Act.
      </p>
      <div style={{ marginTop: 18, padding: "12px 16px", borderLeft: "2px solid #2a4d7a", background: "#e3e5e7" }}>
        <div style={{ fontFamily: FONTS.gothic, fontSize: 9, color: "#2a4d7a", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Ai note · 藍</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 14, fontStyle: "italic", lineHeight: 1.5 }}>Immediate exposure on outstanding invoices. File proof of debt within 10 working days.</div>
      </div>
    </div>
    <div style={{ padding: "18px 26px 24px", borderTop: "1px solid #c6c9ce" }}>
      <a href="#" style={{ fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 600, color: "#2a4d7a", textDecoration: "none", letterSpacing: "0.04em" }}>Open in Mihari →</a>
    </div>
    <div style={{ padding: "14px 26px", borderTop: "1px solid #c6c9ce", fontFamily: FONTS.gothic, fontSize: 10, color: "#5e6168", fontWeight: 500 }}>
      Routed to josh@mihari.nz · Real-time · To mute, adjust in Preferences.
    </div>
  </div>
);

window.Preferences = Preferences;
