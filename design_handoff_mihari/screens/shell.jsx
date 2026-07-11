/* Mihari — app shell (sidebar + top bar)
 * Sidebar: 240px, panel bg, rule right-border, serif nav labels,
 * kanji counters for each item, hanko mark at top. Top bar: breadcrumb +
 * condensed status strip on the right. Theme toggle lives in the top bar.
 */

const Shell = ({ theme, active, children }) => {
  const { dark, setDark, C } = theme;

  const nav = [
    { id: "dashboard",   k: "一", jp: "今日", label: "Dashboard",    sub: "Today" },
    { id: "alerts",      k: "二", jp: "警報", label: "Alerts",       sub: "17 unread", badge: 17 },
    { id: "watchlist",   k: "三", jp: "名簿", label: "Watchlist",    sub: "42 entities" },
    { id: "preferences", k: "四", jp: "設定", label: "Preferences",  sub: "Recipients, triggers, email" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "260px 1fr",
      minHeight: "100vh", background: C.bg, color: C.ink,
      fontFamily: FONTS.serif,
    }}>
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside style={{
        background: C.panel, borderRight: `1px solid ${C.rule}`,
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Brand */}
        <div style={{
          padding: "24px 24px 20px",
          borderBottom: `1px solid ${C.rule}`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <Hanko size={38} C={C} dark={dark} />
          <div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 22, lineHeight: 1, letterSpacing: "-0.01em" }}>Mihari</div>
            <div style={{ fontFamily: FONTS.mincho, fontSize: 11, color: C.inkDim, letterSpacing: "0.32em", marginTop: 4 }}>見張り</div>
          </div>
        </div>

        {/* User block */}
        <div style={{
          padding: "18px 24px",
          borderBottom: `1px solid ${C.rule}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, background: C.panel2, border: `1px solid ${C.rule}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 18, color: C.ink,
          }}>j</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONTS.serif, fontSize: 15, color: C.ink, letterSpacing: "-0.005em" }}>Josh Wong</div>
            <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>josh@mihari.nz</div>
          </div>
          <span style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.ai, fontWeight: 500 }}>↗</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 0", overflow: "auto" }}>
          {nav.map((n) => {
            const isActive = n.id === active;
            return (
              <div key={n.id} style={{
                display: "grid", gridTemplateColumns: "36px 1fr auto",
                alignItems: "center", gap: 12,
                padding: "12px 24px",
                cursor: "pointer",
                background: isActive ? C.bg : "transparent",
                borderLeft: `2px solid ${isActive ? C.vermillion : "transparent"}`,
                position: "relative",
              }}>
                <div style={{
                  fontFamily: FONTS.mincho, fontSize: 22, lineHeight: 1,
                  color: isActive ? C.vermillion : C.inkFaint,
                  fontWeight: 500, textAlign: "center",
                }}>{n.k}</div>
                <div>
                  <div style={{
                    fontFamily: FONTS.serif, fontSize: 16,
                    color: isActive ? C.ink : C.ink,
                    letterSpacing: "-0.005em", lineHeight: 1.2,
                  }}>{n.label}</div>
                  <div style={{ fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500, marginTop: 2 }}>
                    {n.sub}
                  </div>
                </div>
                {n.badge ? (
                  <div style={{
                    fontFamily: FONTS.gothic, fontSize: 10, fontWeight: 600,
                    background: C.vermillion, color: C.bg,
                    padding: "3px 7px", minWidth: 22, textAlign: "center",
                  }}>{n.badge}</div>
                ) : null}
              </div>
            );
          })}
        </nav>

        {/* Footer: theme toggle */}
        <div style={{
          padding: "18px 24px", borderTop: `1px solid ${C.rule}`,
          fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
        }}>
          <button onClick={() => setDark(!dark)} style={{
            width: "100%", background: "none", border: `1px solid ${C.rule}`,
            color: C.ink, fontFamily: FONTS.gothic, fontSize: 12, fontWeight: 500,
            padding: "8px 12px", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "space-between",
          }}>
            <span>{dark ? "Dark" : "Light"} mode</span>
            <span style={{ color: C.inkDim }}>⇄</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          padding: "10px 40px",
          borderBottom: `1px solid ${C.rule}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontFamily: FONTS.gothic, fontSize: 11, color: C.inkDim, fontWeight: 500,
          background: C.bg,
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span style={{ color: C.green }}>●</span>
            <span>Last sweep 06:04 NZST · completed</span>
            <span style={{ color: C.inkFaint }}>│</span>
            <span>42 entities · 5 registrars</span>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <span>⌘K · search</span>
            <span style={{ color: C.inkFaint }}>│</span>
            <span>Help</span>
            <span>Shortcuts</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

window.Shell = Shell;
