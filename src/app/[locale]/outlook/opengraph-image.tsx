import { ImageResponse } from "next/og";

import { ACTIVE_LOCALES, isRtl } from "@/config/locales";
import { formatLongDate, formatSignedPct, formatUsd } from "@/lib/format";
import { BrandCard, OG, OG_SIZE, OG_TAGLINE, OgHeader, signalColor } from "@/lib/og";
import { getPublishedOutlook } from "@/server/outlook";

// Dynamic OG card for /outlook: current signals + spot, regenerated with the
// page (ISR), so shared links always show the live call.
export const alt = "Gold Market Outlook · GoldCompass";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Keeps the card prerendered per locale. A metadata image under a dynamic
 * segment is otherwise generated on demand, and rendering a PNG through satori
 * on every crawler/social-scraper request is expensive on a 1GB instance.
 */
export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale: locale.code }));
}


export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Satori cannot shape or reorder RTL text — see `BrandCard`. Serving the
  // brand card is the correct degradation; serving mangled Arabic is not.
  if (isRtl(locale)) {
    return new ImageResponse(<BrandCard tagline={OG_TAGLINE} />, size);
  }

  const report = getPublishedOutlook(locale);
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
                {formatUsd(report.spot.price, locale)}
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
            ? `Updated ${formatLongDate(report.updatedAt, locale)} · Educational, not financial advice`
            : "Educational, not financial advice"}
        </div>
      </div>
    ),
    size,
  );
}
