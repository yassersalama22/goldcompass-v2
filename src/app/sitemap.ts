import type { MetadataRoute } from "next";

import { INSIGHT_KINDS } from "@/config/insight-kinds";
import { ACTIVE_LOCALES, DEFAULT_LOCALE, localizePath } from "@/config/locales";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { getAllArticles } from "@/server/articles";

/**
 * Absolute URL for a path in a locale.
 *
 * The lone trailing slash on the home page is stripped so the sitemap entry is
 * byte-identical to the `<link rel="canonical">` Next emits for that page. A
 * sitemap URL that differs from its own canonical by a trailing slash is a
 * needless "which one do you mean?" signal to a crawler.
 */
function absolute(path: string, locale: string): string {
  const localized = localizePath(path, locale);
  return `${siteConfig.url}${localized === "/" ? "" : localized}`;
}

/**
 * Lives outside `src/app/[locale]` on purpose: there is exactly one sitemap for
 * the site, listing every locale, rather than one per locale. Search engines
 * expect the alternates to be declared *inside* each URL entry, which is what
 * `alternates.languages` below emits (`<xhtml:link rel="alternate" hreflang=…>`).
 */

const routes = [
  "",
  "/outlook",
  "/trends",
  "/insights",
  "/calculator",
  "/about",
  "/methodology",
  "/ai-disclosure",
  "/disclaimer",
];

/**
 * One entry per active locale for a locale-independent path, each carrying the
 * full set of language alternates.
 *
 * `availableLocales` exists for content that is not translated everywhere —
 * pass the locales that actually have an artifact. Advertising an alternate that
 * 404s is worse than advertising none, because it invites the wrong URL into
 * results for the wrong audience.
 */
function localizedEntries(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> = {},
  availableLocales: readonly string[] = ACTIVE_LOCALES.map((l) => l.code),
): MetadataRoute.Sitemap {
  const advertised = ACTIVE_LOCALES.filter((l) => availableLocales.includes(l.code));
  if (advertised.length === 0) return [];

  const languages =
    advertised.length > 1
      ? Object.fromEntries(
          advertised.map((l) => [
            l.hreflang,
            absolute(path, l.code),
          ]),
        )
      : undefined;

  return advertised.map((locale) => ({
    url: absolute(path, locale.code),
    ...extra,
    ...(languages
      ? {
          alternates: {
            languages: {
              ...languages,
              ...(availableLocales.includes(DEFAULT_LOCALE)
                ? {
                    "x-default": absolute(path, DEFAULT_LOCALE),
                  }
                : {}),
            },
          },
        }
      : {}),
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = routes.flatMap((route) =>
    localizedEntries(route, {
      changeFrequency: route === "/trends" ? "hourly" : "weekly",
      priority: route === "" ? 1 : 0.7,
    }),
  );

  const insightKindEntries = INSIGHT_KINDS.flatMap((kind) =>
    localizedEntries(kind.href, { changeFrequency: "weekly", priority: 0.6 }),
  );

  const toolEntries = TOOLS.flatMap((tool) =>
    localizedEntries(tool.href, { changeFrequency: "weekly", priority: 0.7 }),
  );

  // TODO(i18n Phase C): pass the locales each article has been translated into,
  // once translated artifacts exist. Today every active locale serves every
  // article, so the default is accurate.
  const articleEntries = getAllArticles().flatMap((article) =>
    localizedEntries(`/insights/${article.slug}`, {
      lastModified: article.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  return [...staticEntries, ...insightKindEntries, ...toolEntries, ...articleEntries];
}
