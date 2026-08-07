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

/**
 * Brand-only card: the mark, the wordmark, and the domain. No page-specific text.
 *
 * ⚠ This is also the **fallback for right-to-left locales**, and that is a real
 * constraint rather than a stylistic choice: satori — the renderer behind
 * `next/og` — states plainly in its README that "RTL languages are not supported
 * either". It performs no bidi reordering and no Arabic contextual shaping, so
 * Arabic text comes out as disconnected, reversed letterforms. That is worse
 * than showing no text at all, because it renders as a broken image in every
 * social preview and messaging app.
 *
 * So RTL pages get this card, which contains only Latin brand text. Per-locale
 * titled cards need a renderer with real text shaping (`takumi` is the drop-in
 * candidate, but it ships native binaries and this deploys to arm64 Alpine on a
 * 1GB instance) or an offline pre-render through headless Chrome. Until one of
 * those is done, do not add localized text to an OG card.
 */
export function BrandCard({ tagline }: { tagline: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        background: OG.bgGradient,
      }}
    >
      <CompassMark size={140} />
      <Wordmark fontSize={96} />
      <div
        style={{
          display: "flex",
          color: OG.muted,
          fontSize: 34,
          textAlign: "center",
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 12,
          padding: "10px 28px",
          borderRadius: 999,
          border: `2px solid ${OG.border}`,
          color: OG.gold,
          fontSize: 28,
        }}
      >
        goldcompass.app
      </div>
    </div>
  );
}

/** Tagline used on the brand card — Latin script only, see `BrandCard`. */
export const OG_TAGLINE = "Gold market outlooks · Live prices · Smart calculator";
