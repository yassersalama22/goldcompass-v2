import { ImageResponse } from "next/og";

import { isRtl } from "@/config/locales";
import { formatLongDate } from "@/lib/format";
import { BrandCard, OG, OG_SIZE, OG_TAGLINE, OgHeader } from "@/lib/og";
import { getArticleBySlug } from "@/server/articles";

// Per-article OG card: category + title over the brand treatment.
export const alt = "GoldCompass market insight";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // See `BrandCard`: satori has no RTL shaping, so an Arabic title would render
  // as broken glyphs in every social preview.
  if (isRtl(locale)) {
    return new ImageResponse(<BrandCard tagline={OG_TAGLINE} />, size);
  }

  const article = getArticleBySlug(slug);

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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {article ? (
            <div
              style={{
                display: "flex",
                color: OG.gold,
                fontSize: 26,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              {article.category}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              color: OG.fg,
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.15,
              lineClamp: 4,
            }}
          >
            {article?.title ?? "Gold market insights"}
          </div>
        </div>

        <div style={{ display: "flex", color: OG.muted, fontSize: 24 }}>
          {article
            ? `${formatLongDate(article.date, locale)} · Educational, not financial advice`
            : "Educational, not financial advice"}
        </div>
      </div>
    ),
    size,
  );
}
