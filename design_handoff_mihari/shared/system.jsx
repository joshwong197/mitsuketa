/* Mihari — shared system primitives
 * Colour tokens, Label, Hanko, SeverityKanji. Used by every product screen.
 */

const useMihariTheme = (initial = true) => {
  const [dark, setDark] = React.useState(initial);
  const C = dark ? {
    bg: "#0b0c0e", panel: "#111317", panel2: "#16191e",
    ink: "#e8e6df", inkDim: "#8d8d85", inkFaint: "#4a4a45",
    rule: "#23262c", ruleSoft: "#1a1d22",
    ai: "#8fb5e0", aiDeep: "#4a77a8",
    vermillion: "#e3594a", amber: "#d9a54a", green: "#7fc28f",
  } : {
    bg: "#eceeef", panel: "#f4f5f6", panel2: "#e3e5e7",
    ink: "#14161a", inkDim: "#5e6168", inkFaint: "#a8abb0",
    rule: "#c6c9ce", ruleSoft: "#d8dbdf",
    ai: "#2a4d7a", aiDeep: "#1a3558",
    vermillion: "#b82f21", amber: "#a87623", green: "#3a6f4a",
  };
  return { dark, setDark, C };
};

const FONTS = {
  serif: '"Source Serif 4", Georgia, serif',
  mincho: '"Shippori Mincho", "Noto Serif JP", serif',
  gothic: '"Zen Kaku Gothic New", "Helvetica Neue", system-ui, sans-serif',
};

const Label = ({ num, jp, children, color, C }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    fontFamily: FONTS.gothic, fontSize: 12,
    color: color || C.inkDim, letterSpacing: "0.02em", fontWeight: 500,
  }}>
    {num && <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 22, lineHeight: 1, color: color || C.inkDim }}>{num}</span>}
    {jp && <span style={{ fontFamily: FONTS.mincho, fontSize: 14, letterSpacing: "0.25em", fontWeight: 500 }}>{jp}</span>}
    <span style={{ width: 24, height: 1, background: color || C.rule }} />
    <span>{children}</span>
  </div>
);

const Hanko = ({ size = 34, C, dark }) => (
  <div style={{ position: "relative", width: size, height: size, display: "inline-block", flexShrink: 0 }}>
    <div style={{
      position: "absolute", inset: 0, background: C.vermillion,
      boxShadow: size > 60 ? "inset 0 0 60px rgba(0,0,0,0.25)" : "none",
    }} />
    {size >= 60 && (
      <div style={{
        position: "absolute", inset: "6%",
        border: `${Math.max(2, size * 0.012)}px solid ${C.bg}`,
      }} />
    )}
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONTS.mincho, fontWeight: 800, color: C.bg,
      fontSize: size * 0.62, lineHeight: 1,
    }}>見</div>
  </div>
);

// Severity kanji square — the canonical badge
const SevKanji = ({ sev, size = 28, C }) => {
  const map = {
    red:   { k: "紅", col: C.vermillion },
    amber: { k: "琥", col: C.amber },
    green: { k: "青", col: C.green },
  };
  const { k, col } = map[sev] || map.green;
  return (
    <div style={{
      width: size, height: size, background: col, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONTS.mincho, color: C.bg, fontSize: size * 0.6, fontWeight: 700,
    }}>{k}</div>
  );
};

window.useMihariTheme = useMihariTheme;
window.FONTS = FONTS;
window.Label = Label;
window.Hanko = Hanko;
window.SevKanji = SevKanji;
