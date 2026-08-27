import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_LOCALE } from "@/config/locales";
import { PAGE_CONTRACT_VERSION, pageSchema, type PageDoc } from "@/types/page";

/**
 * Static prose page data-access layer (headless core).
 *
 * Artifacts live at `src/content/pages/<slug>.md` for the canonical locale and
 * `src/content/pages/<locale>/<slug>.md` for translations — the same sibling
 * -directory convention as articles, so `i18n:check` can pair a translation
 * with its source by filename.
 */

const PAGES_DIR = path.join(process.cwd(), "src", "content", "pages");

/**
 * Minimal frontmatter parser.
 *
 * Deliberately not a YAML library. The frontmatter here is a fixed set of
 * flat `key: value` strings — no nesting, no lists, no anchors — so a real YAML
 * parser would be a dependency (and a parsing surface) bought for nothing. The
 * one thing it must handle is values containing colons, which is why the split
 * is on the *first* colon only.
 *
 * Values may be quoted to protect leading/trailing whitespace or a leading `#`;
 * quotes are stripped. Anything more elaborate than that belongs in the body.
 */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("Page artifact is missing its frontmatter block.");
  }
  const [, head, body] = match;

  const data: Record<string, string> = {};
  for (const line of head.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: body.trim() };
}

function readPage(dir: string, slug: string): PageDoc | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(dir, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  const { data, body } = parseFrontmatter(raw);
  return pageSchema.parse({
    contractVersion: PAGE_CONTRACT_VERSION,
    slug,
    ...data,
    bodyMarkdown: body,
  });
}

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
      const translated = readPage(path.join(PAGES_DIR, locale), slug);
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
  return readPage(path.join(PAGES_DIR, locale), slug) !== null;
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
