import { ImageResponse } from "next/og";

import { CompassMark, OG, OG_SIZE, Wordmark } from "@/lib/og";

// Site-wide default Open Graph image (deeper segments override with their own).
export const alt = "GoldCompass — Smart Gold Investing Guidance";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
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
          Gold market outlooks · Live prices · Smart calculator
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
    ),
    size,
  );
}
