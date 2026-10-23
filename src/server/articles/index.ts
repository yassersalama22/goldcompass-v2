import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_LOCALE } from "@/config/locales";
import { articleFields, hashFields } from "@/server/i18n/field-map";
import { articleSchema, type Article, type ArticleKind } from "@/types/article";

/**
 * Articles data-access layer (headless core). Reads the committed article
 * artifacts (Git-as-CMS), validates them, and returns only published ones,
 * newest first. Web pages + `/api/v1/articles` both go through here.
 *
 * Reads happen at build (SSG) and on ISR revalidation. NOTE for Phase 7
 * (Docker standalone): include `src/content/**` via `outputFileTracingIncludes`
 * so runtime revalidation can still read these files.
 */
const ARTICLES_DIR = path.join(process.cwd(), "src", "content", "articles");

/**
 * Translations live in a sibling directory per locale, sharing the source
 * filename: `articles/<file>.json` and `articles/ar/<file>.json`. Matching by
 * filename is what lets `i18n:check` pair a translation with its source, and it
 * is why translated articles reuse the English slug.
 */
function localeDir(locale: string): string {
  return locale === DEFAULT_LOCALE ? ARTICLES_DIR : path.join(ARTICLES_DIR, locale);
}

function readPublished(dir: string): Map<string, Article> {
  const byFile = new Map<string, Article>();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return byFile; // directory missing (e.g. nothing translated yet)
  }
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = articleSchema.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.status === "published") {
      byFile.set(file, parsed.data);
    } else if (!parsed.success) {
      console.warn(`[articles] skipping invalid ${file}:`, parsed.error.message);
    }
  }
  return byFile;
}

/**
 * Published articles for `locale`, newest first.
 *
 * An article with no translation yet falls back to its English text rather than
 * vanishing: a reader who follows an Arabic link to a piece we have not
 * translated should get the piece, not a 404, and an archive that silently drops
 * half its entries is worse than one that is visibly mixed. The page is
 * responsible for not claiming, via hreflang, that a translation exists —
 * `isArticleTranslated` below is how it knows.
 */
/**
 * Translations of `locale` that are CURRENT — made from the English text as it
 * stands now. A translation whose `sourceHash` no longer matches is treated as
 * missing (English is shown, labelled as English, and no hreflang is claimed),
 * because a stale translation can contradict the source it claims to render.
 * Keyed by source filename, like `readPublished`.
 */
const freshTranslations = cache((locale: string): Map<string, Article> => {
  const english = readPublished(ARTICLES_DIR);
  const fresh = new Map<string, Article>();
  for (const [file, translated] of readPublished(localeDir(locale))) {
    const source = english.get(file);
    if (!source) continue; // orphaned translation — its source was unpublished
    if (translated.translation?.sourceHash === hashFields(articleFields(source))) {
      fresh.set(file, translated);
    } else {
      console.warn(`[articles] ${locale}/${file} is stale; falling back to English`);
    }
  }
  return fresh;
});

export const getAllArticles = cache((locale: string = DEFAULT_LOCALE): Article[] => {
  const english = readPublished(ARTICLES_DIR);
  const translated = locale === DEFAULT_LOCALE ? english : freshTranslations(locale);

  const articles = [...english.entries()].map(
    ([file, article]) => translated.get(file) ?? article,
  );

  // Newest first (ISO date strings sort lexicographically).
  return articles.sort((a, b) => b.date.localeCompare(a.date));
});

/** Slugs that have their own published translation in `locale`. */
export const translatedSlugs = cache((locale: string): Set<string> => {
  if (locale === DEFAULT_LOCALE) {
    return new Set(getAllArticles().map((a) => a.slug));
  }
  return new Set([...freshTranslations(locale).values()].map((a) => a.slug));
});

/** Does this article have its own published translation in `locale`? */
export function isArticleTranslated(slug: string, locale: string): boolean {
  return translatedSlugs(locale).has(slug);
}

export const getRecentArticles = cache(
  (limit: number, locale: string = DEFAULT_LOCALE): Article[] =>
    getAllArticles(locale).slice(0, limit),
);

export const getArticleBySlug = cache(
  (slug: string, locale: string = DEFAULT_LOCALE): Article | null =>
    getAllArticles(locale).find((a) => a.slug === slug) ?? null,
);

export const getAllArticleSlugs = cache((): string[] =>
  getAllArticles().map((a) => a.slug),
);

/** Published articles of one kind, newest first — backs the /insights sub-views. */
export const getArticlesByKind = cache(
  (kind: ArticleKind, locale: string = DEFAULT_LOCALE): Article[] =>
    getAllArticles(locale).filter((a) => a.kind === kind),
);

/** Distinct categories present in published articles. */
export const getArticleCategories = cache(
  (locale: string = DEFAULT_LOCALE): string[] =>
    Array.from(new Set(getAllArticles(locale).map((a) => a.category))).sort(),
);
