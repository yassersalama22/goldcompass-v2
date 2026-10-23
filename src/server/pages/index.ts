import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_LOCALE } from "@/config/locales";
import { parsePageMarkdown } from "@/lib/page-markdown";
import { hashFields, pageFields } from "@/server/i18n/field-map";
import type { PageDoc } from "@/types/page";

/**
 * Static prose page data-access layer (headless core).
 *
 * Artifacts live at `src/content/pages/<slug>.md` for the canonical locale and
 * `src/content/pages/<locale>/<slug>.md` for translations — the same sibling
 * -directory convention as articles, so `i18n:check` can pair a translation
 * with its source by filename.
 */

const PAGES_DIR = path.join(process.cwd(), "src", "content", "pages");

function readPage(dir: string, slug: string): PageDoc | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(dir, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  return parsePageMarkdown(raw, slug);
}

/**
 * The translation of `slug` in `locale`, only if it was made from the English
 * text as it stands now — the same rule as the outlook and articles. A stale
 * legal page in particular must not keep asserting terms the English has since
 * changed.
 */
const freshTranslation = cache((slug: string, locale: string): PageDoc | null => {
  const translated = readPage(path.join(PAGES_DIR, locale), slug);
  const canonical = readPage(PAGES_DIR, slug);
  if (!translated || !canonical) return null;
  if (translated.translation?.sourceHash !== hashFields(pageFields(canonical))) {
    console.warn(`[pages] ${locale}/${slug} is stale; falling back to English`);
    return null;
  }
  return translated;
});

/**
 * The page in `locale`, falling back to the canonical text when there is no
 * translation yet.
 *
 * Falls back rather than 404ing for the same reason articles do: a reader who
 * followed an Arabic link should get the page. `isPageTranslated` is how the
 * route decides whether to advertise a translation in hreflang.
 */
export const getPage = cache(
  (slug: string, locale: string = DEFAULT_LOCALE): PageDoc => {
    if (locale !== DEFAULT_LOCALE) {
      const translated = freshTranslation(slug, locale);
      if (translated) return translated;
    }
    const canonical = readPage(PAGES_DIR, slug);
    if (!canonical) {
      // A missing artifact is a build-time authoring error, not a runtime
      // condition — the routes are static and their slugs are literals.
      throw new Error(`No page artifact for "${slug}".`);
    }
    return canonical;
  },
);

/** Does `locale` have its own translation of this page? */
export const isPageTranslated = cache((slug: string, locale: string): boolean => {
  if (locale === DEFAULT_LOCALE) return true;
  return freshTranslation(slug, locale) !== null;
});

/** Every canonical page slug — used by the Markdown-representation map. */
export const getAllPageSlugs = cache((): string[] => {
  try {
    return fs
      .readdirSync(PAGES_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
});
