import { ImageResponse } from "next/og";

import { formatSignedPct } from "@/lib/format";
import { OG, OG_SIZE, OgHeader, signalColor } from "@/lib/og";
import { getPublishedOutlook } from "@/server/outlook";

// Dynamic OG card for /outlook: current signals + spot, regenerated with the
// page (ISR), so shared links always show the live call.
export const alt = "Gold Market Outlook · GoldCompass";
export const size = OG_SIZE;
export const contentType = "image/png";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function OpengraphImage() {
  const report = getPublishedOutlook();
  const change = report?.spot.changePct;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: OG.bgGradient,
        }}
      >
        <OgHeader />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", color: OG.fg, fontSize: 64, fontWeight: 700 }}>
            Gold Market Outlook
          </div>
          {report ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span style={{ color: OG.gold, fontSize: 56, fontWeight: 700 }}>
                {priceFormatter.format(report.spot.price)}
              </span>
              <span style={{ color: OG.muted, fontSize: 30 }}>XAU/USD</span>
              {change != null ? (
                <span
                  style={{
                    color: change < 0 ? OG.bear : OG.bull,
                    fontSize: 34,
                    fontWeight: 600,
                  }}
                >
                  {formatSignedPct(change)}
                </span>
              ) : null}
            </div>
          ) : null}

          {report ? (
            <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
              {report.calls.map((call) => (
                <div
                  key={call.term}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "20px 32px",
                    borderRadius: 16,
                    border: `2px solid ${OG.border}`,
                  }}
                >
                  <span style={{ color: OG.muted, fontSize: 24 }}>
                    {call.label} · {call.horizon}
                  </span>
                  <span
                    style={{
                      color: signalColor(call.signal),
                      fontSize: 44,
                      fontWeight: 700,
                    }}
                  >
                    {call.signal}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", color: OG.muted, fontSize: 24 }}>
          {report
            ? `Updated ${dateFormatter.format(new Date(report.updatedAt))} · Educational, not financial advice`
            : "Educational, not financial advice"}
        </div>
      </div>
    ),
    size,
  );
}
