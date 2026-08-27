import { getTranslations } from "next-intl/server";

import { ACTIVE_LOCALES, localizePath, requireLocale } from "@/config/locales";
import { siteConfig } from "@/config/site";
import { getAllArticles } from "@/server/articles";

export const revalidate = 3600;

/**
 * Required for the feed to stay prerendered: a route handler under a dynamic
 * segment is server-rendered on demand unless its params are enumerated. Without
 * this the feed becomes `ƒ` and every request hits the origin.
 */
export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale: locale.code }));
}


/**
 * One feed per locale: `/insights/rss.xml` in English, `/ar/insights/rss.xml` in
 * Arabic. A single mixed-language feed would be unreadable for subscribers of
 * either language, and `<language>` can only name one.
 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const articles = getAllArticles(locale);
  const abs = (path: string) => `${siteConfig.url}${localizePath(path, locale)}`;
  const items = articles
    .map((a) => {
      const url = abs(`/insights/${a.slug}`);
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <category>${escapeXml(a.category)}</category>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <description>${escapeXml(a.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteConfig.name)} — Market Insights</title>
    <link>${abs("/insights")}</link>
    <description>${escapeXml(t("site.shortDescription"))}</description>
    <language>${requireLocale(locale).hreflang}</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
