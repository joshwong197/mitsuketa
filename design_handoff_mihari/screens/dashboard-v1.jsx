/* Mihari — Dashboard
 * Feed-first, airy editorial. Today-first hero. No stat-card-grid cliché.
 * Layout: (1) Date masthead, (2) Today's alert feed as primary column,
 * (3) Right rail — Watchlist pulse, 7-day sparkline of severity, next sweep.
 */

const Dashboard = ({ theme }) => {
  const { C } = theme;

  const todayAlerts = [
  { id: "a1", t: "07:12", sev: "red", title: "Liquidator appointed", entity: "Kōwhai Logistics Ltd", nzbn: "9429 0440 31210", src: "Insolvency Register", detail: "Voluntary liquidation filed by the sole director. First creditors' meeting scheduled within 10 working days." },
  { id: "a2", t: "06:48", sev: "amber", title: "Director resigned", entity: "Harbourline Freight Ltd", nzbn: "9429 0311 80944", src: "NZ Companies Office", detail: "Hana Whitiora ceased as director. Two of three directors now remaining; no replacement filed." },
  { id: "a3", t: "05:30", sev: "green", title: "Annual return filed", entity: "Tāwhiri Analytics Ltd", nzbn: "9429 0488 22115", src: "NZ Companies Office" },
  { id: "a4", t: "04:22", sev: "amber", title: "Registered office changed", entity: "Mānuka & Sons Builders Ltd", nzbn: "9429 0417 55028", src: "NZ Companies Office", detail: "New address is a residential unit in Papatoetoe. Previous address was a commercial premises." },
  { id: "a5", t: "02:15", sev: "red", title: "Gazette — statutory demand", entity: "Parnell Craft Coffee Ltd", nzbn: "9429 0501 38844", src: "NZ Gazette", detail: "Demand for $84,220 served under s289 Companies Act. 15 working days to comply." }];


  const yesterday = [
  { t: "22:18", sev: "green", title: "Annual return filed", entity: "Ōtira Outdoor Co Ltd" },
  { t: "19:04", sev: "amber", title: "Shareholding changed", entity: "Blue Pacific Holdings" },
  { t: "16:33", sev: "green", title: "Address verified", entity: "Pōhutukawa Press Ltd" },
  { t: "14:02", sev: "red", title: "Court judgment entered", entity: "South Central Build Group" }];


  return (
    <main style={{
      padding: "56px 64px 120px",
      maxWidth: 1440, margin: "0 auto", width: "100%",
      fontFamily: FONTS.serif
    }}>
      {/* ─── Masthead ─────────────────────────────────────── */}
      <header style={{ marginBottom: 56 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 40, marginBottom: 24 }}>
          <Label num="I" jp="今日" C={C}>Today's watch</Label>
          <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.04em" }}>MONDAY · 13 JANUARY 2026 

          </div>
        </div>
        <h1 style={{
          fontFamily: FONTS.serif, fontWeight: 400, fontSize: 68, lineHeight: 1.04,
          letterSpacing: "-0.02em", color: C.ink, margin: 0, maxWidth: 920
        }}>
          17 changes on 42 entities
          <span style={{ color: C.vermillion }}>.</span>
          <span style={{ color: C.inkDim, display: "block", fontSize: 32, marginTop: 14, letterSpacing: "-0.01em" }}>
            Two ask for your attention <span style={{ fontStyle: "italic" }}>now</span>.
          </span>
        </h1>
      </header>

      {/* ─── Body grid ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 80 }}>
        {/* ═══ Primary column: today's feed ═══ */}
        <section>
          {/* Critical block — red alerts pulled forward */}
          <div style={{
            borderTop: `2px solid ${C.vermillion}`,
            paddingTop: 20, marginBottom: 44
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontFamily: FONTS.mincho, fontSize: 20, color: C.vermillion, fontWeight: 600 }}>紅</span>
                <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 22, color: C.ink }}>Requires attention</span>
                <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.1em" }}>— 2 ITEMS</span>
              </div>
              <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 500, cursor: "pointer" }}>Dismiss all →</span>
            </div>

            {todayAlerts.filter((a) => a.sev === "red").map((a, i, arr) =>
            <article key={a.id} style={{
              display: "grid", gridTemplateColumns: "72px 1fr auto",
              gap: 28, padding: "24px 0",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.rule}` : "none"
            }}>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, paddingTop: 6, letterSpacing: "0.05em" }}>
                  {a.t}
                </div>
                <div>
                  <h3 style={{
                  fontFamily: FONTS.serif, fontWeight: 500, fontSize: 28, lineHeight: 1.15,
                  letterSpacing: "-0.01em", color: C.ink, margin: 0, marginBottom: 6
                }}>{a.title}<span style={{ color: C.vermillion }}>.</span></h3>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 17, color: C.inkDim, marginBottom: 14 }}>
                    <span style={{ color: C.ink, fontStyle: "italic" }}>{a.entity}</span>
                    <span style={{ color: C.inkFaint }}> · NZBN {a.nzbn}</span>
                  </div>
                  {a.detail &&
                <p style={{
                  fontFamily: FONTS.serif, fontSize: 16, lineHeight: 1.55, color: C.ink,
                  margin: 0, marginBottom: 14, maxWidth: 620, textWrap: "pretty"
                }}>{a.detail}</p>
                }
                  <div style={{ display: "flex", gap: 18, alignItems: "center", fontFamily: FONTS.gothic, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>
                    <span style={{ color: C.inkDim }}>SOURCE · {a.src}</span>
                    <span style={{ color: C.inkFaint }}>│</span>
                    <span style={{ color: C.ai, cursor: "pointer" }}>Open entity →</span>
                    <span style={{ color: C.ai, cursor: "pointer" }}>Acknowledge</span>
                    <span style={{ color: C.inkDim, cursor: "pointer" }}>Snooze 24h</span>
                  </div>
                </div>
                <SevKanji sev={a.sev} size={32} C={C} />
              </article>
            )}
          </div>

          {/* Amber + green — quieter list */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
              <Label num="II" jp="其他" C={C}>Rest of today</Label>
              <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, letterSpacing: "0.1em", marginLeft: "auto" }}>15 ITEMS · 3 SHOWN</span>
            </div>
            {todayAlerts.filter((a) => a.sev !== "red").map((a, i) =>
            <article key={a.id} style={{
              display: "grid", gridTemplateColumns: "72px 28px 1fr auto",
              gap: 20, padding: "20px 0",
              borderBottom: `1px solid ${C.ruleSoft}`,
              alignItems: "start"
            }}>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.inkDim, fontWeight: 500, paddingTop: 4, letterSpacing: "0.05em" }}>
                  {a.t}
                </div>
                <SevKanji sev={a.sev} size={22} C={C} />
                <div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 19, color: C.ink, letterSpacing: "-0.005em", marginBottom: 2 }}>
                    {a.title}
                  </div>
                  <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 15, color: C.inkDim }}>
                    {a.entity}
                  </div>
                  {a.detail &&
                <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.inkDim, marginTop: 6, maxWidth: 540 }}>
                      {a.detail}
                    </div>
                }
                </div>
                <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.04em", paddingTop: 6, textAlign: "right" }}>
                  {a.src.toUpperCase()}
                </div>
              </article>
            )}
            <div style={{ textAlign: "center", padding: "28px 0 0" }}>
              <span style={{ fontFamily: FONTS.gothic, fontSize: 12, color: C.ai, fontWeight: 500, cursor: "pointer", letterSpacing: "0.04em" }}>
                Show twelve more →
              </span>
            </div>
          </div>

          {/* Yesterday */}
          <div style={{ marginTop: 64, opacity: 0.72 }}>
            <Label num="III" jp="昨日" C={C}>Yesterday</Label>
            <div style={{ marginTop: 16 }}>
              {yesterday.map((a, i) =>
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "72px 22px 1fr auto",
                gap: 20, padding: "12px 0",
                borderBottom: i < yesterday.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
                alignItems: "center"
              }}>
                  <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, letterSpacing: "0.05em", fontWeight: 500 }}>{a.t}</span>
                  <SevKanji sev={a.sev} size={16} C={C} />
                  <span style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink }}>
                    {a.title} <span style={{ fontStyle: "italic", color: C.inkDim }}>— {a.entity}</span>
                  </span>
                  <span style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500 }}>→</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ Right rail ═══ */}
        <aside style={{ paddingTop: 4 }}>
          {/* Sweep status */}
          <div style={{ paddingBottom: 28, borderBottom: `1px solid ${C.rule}` }}>
            <Label num="i" jp="巡回" C={C}>Current sweep</Label>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: FONTS.serif, fontSize: 40, color: C.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>
                12<span style={{ color: C.inkFaint }}>/</span><span style={{ color: C.inkDim, fontSize: 28 }}>21</span>
              </div>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, marginTop: 6, fontWeight: 500, letterSpacing: "0.04em" }}>
                REGISTRARS CHECKED · NEXT 14:00
              </div>
            </div>
            {/* Registrar strip */}
            <div style={{ marginTop: 18, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Array.from({ length: 21 }).map((_, i) =>
              <div key={i} style={{
                width: 10, height: 18,
                background: i < 12 ? C.ai : i === 12 ? C.amber : C.ruleSoft
              }} />
              )}
            </div>
            <div style={{ marginTop: 10, fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, letterSpacing: "0.05em", fontWeight: 500 }}>
              NZBN · GAZETTE · INSOLVENCY · DISQ · PPSR · CO.OFFICE · ...
            </div>
          </div>

          {/* Watchlist pulse */}
          <div style={{ paddingTop: 28, paddingBottom: 28, borderBottom: `1px solid ${C.rule}` }}>
            <Label num="ii" jp="名簿" C={C}>Watchlist pulse</Label>
            <div style={{ marginTop: 18 }}>
              {[
              { k: "紅", l: "Red — attention", v: 2, c: C.vermillion },
              { k: "琥", l: "Amber — watch", v: 6, c: C.amber },
              { k: "青", l: "Green — filings", v: 34, c: C.green }].
              map((r, i) =>
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "22px 1fr auto",
                alignItems: "center", gap: 14, padding: "10px 0"
              }}>
                  <span style={{ fontFamily: FONTS.mincho, fontSize: 18, color: r.c, lineHeight: 1 }}>{r.k}</span>
                  <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.l}</span>
                  <span style={{ fontFamily: FONTS.serif, fontSize: 22, color: r.c, letterSpacing: "-0.02em" }}>{r.v}</span>
                </div>
              )}
            </div>
            {/* 14-day pulse — tiny bar chart */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, letterSpacing: "0.05em", fontWeight: 500, marginBottom: 10 }}>
                14-DAY PULSE
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 48 }}>
                {[3, 5, 2, 7, 4, 6, 3, 8, 5, 4, 9, 6, 7, 5].map((h, i) =>
                <div key={i} style={{
                  flex: 1, height: `${h * 10}%`,
                  background: h > 7 ? C.vermillion : h > 4 ? C.amber : C.ai,
                  opacity: i === 13 ? 1 : 0.7
                }} />
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: FONTS.gothic, fontSize: 10, color: C.inkFaint, fontWeight: 500 }}>
                <span>30 DEC</span><span>TODAY</span>
              </div>
            </div>
          </div>

          {/* Queue */}
          <div style={{ paddingTop: 28 }}>
            <Label num="iii" jp="諸元" C={C}>This week</Label>
            <div style={{ marginTop: 16 }}>
              {[
              { l: "Annual returns due", v: "3", sub: "Pōhutukawa, Ōtira, Harbour" },
              { l: "Trial ending", v: "4 days", sub: "Upgrade to keep Gazette" },
              { l: "CSV imports queued", v: "1", sub: "128 rows · awaiting review" }].
              map((r, i) =>
              <div key={i} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${C.ruleSoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: FONTS.serif, fontSize: 14, color: C.ink }}>{r.l}</span>
                    <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 15, color: C.ai }}>{r.v}</span>
                  </div>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, marginTop: 3, fontWeight: 500 }}>
                    {r.sub}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Footer colophon */}
      <footer style={{
        marginTop: 120, paddingTop: 24, borderTop: `1px solid ${C.rule}`,
        display: "flex", justifyContent: "space-between",
        fontFamily: FONTS.gothic, fontSize: 11, color: C.inkFaint, fontWeight: 500, letterSpacing: "0.05em"
      }}>
        <span>MIHARI · 見張り · CREDIT MONITORING</span>
        <span>SWEEP 12 · NZST 13:42:18 · v0.4.2</span>
      </footer>
    </main>);

};

window.Dashboard = Dashboard;