/**
 * Shared building blocks for the file-convention `opengraph-image.tsx` routes
 * (rendered by next/og → satori). Satori only supports flexbox and plain hex
 * colors, so the design-system oklch tokens are approximated here as hex —
 * sampled from the brand favicon (src/app/icon.svg) and globals.css.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: "#1a1714",
  bgGradient: "linear-gradient(135deg, #1a1714 0%, #2b2318 100%)",
  fg: "#f5f0e6",
  muted: "#a89f8d",
  gold: "#d4a72c",
  bull: "#4cbd7c",
  bear: "#e2604f",
  border: "#3a3226",
};

/** Signal → color, matching the site's bull/bear/gold convention. */
export function signalColor(signal: "BUY" | "HOLD" | "SELL"): string {
  if (signal === "BUY") return OG.bull;
  if (signal === "SELL") return OG.bear;
  return OG.gold;
}

/** The compass mark from src/app/icon.svg, at an arbitrary size. */
export function CompassMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size}>
      <rect width="32" height="32" rx="7" fill={OG.bg} />
      <circle cx="16" cy="16" r="10" fill="none" stroke={OG.gold} strokeWidth="2" />
      <polygon points="16,7 19,16 16,25 13,16" fill={OG.gold} />
      <circle cx="16" cy="16" r="1.6" fill={OG.bg} />
    </svg>
  );
}

/** "GoldCompass" wordmark with the two-tone brand treatment. */
export function Wordmark({ fontSize }: { fontSize: number }) {
  return (
    <div style={{ display: "flex", fontSize, fontWeight: 700 }}>
      <span style={{ color: OG.gold }}>Gold</span>
      <span style={{ color: OG.fg }}>Compass</span>
    </div>
  );
}

/** Small top bar: mark + wordmark on the left, domain on the right. */
export function OgHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <CompassMark size={48} />
        <Wordmark fontSize={36} />
      </div>
      <div style={{ display: "flex", color: OG.muted, fontSize: 26 }}>
        goldcompass.app
      </div>
    </div>
  );
}
