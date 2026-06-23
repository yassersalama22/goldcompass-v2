import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

import { articleSchema, type Article } from "@/types/article";

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

export const getAllArticles = cache((): Article[] => {
  let files: string[];
  try {
    files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // directory missing (e.g. nothing published yet)
  }

  const articles: Article[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8");
    const parsed = articleSchema.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.status === "published") {
      articles.push(parsed.data);
    } else if (!parsed.success) {
      console.warn(`[articles] skipping invalid ${file}:`, parsed.error.message);
    }
  }

  // Newest first (ISO date strings sort lexicographically).
  return articles.sort((a, b) => b.date.localeCompare(a.date));
});

export const getRecentArticles = cache((limit: number): Article[] =>
  getAllArticles().slice(0, limit),
);

export const getArticleBySlug = cache(
  (slug: string): Article | null =>
    getAllArticles().find((a) => a.slug === slug) ?? null,
);

export const getAllArticleSlugs = cache((): string[] =>
  getAllArticles().map((a) => a.slug),
);

/** Distinct categories present in published articles. */
export const getArticleCategories = cache((): string[] =>
  Array.from(new Set(getAllArticles().map((a) => a.category))).sort(),
);
