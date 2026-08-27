import { z } from "zod";

import { translationMetaSchema } from "@/types/translation";

/**
 * Static prose page contract.
 *
 * The long-form trust pages — methodology, AI disclosure, about, disclaimer —
 * used to live as hand-written JSX. Moving their bodies into content artifacts
 * buys three things at once: they become translatable through the same pipeline
 * as articles, they gain a Markdown representation for agents (closing the gap
 * `lib/agent-markdown.ts` documented as deliberately unfixed), and the page
 * components shrink to layout.
 *
 * Stored as Markdown with frontmatter rather than JSON, unlike articles. These
 * are the pages a human edits by hand, and a 400-line body inside a JSON string
 * is unreviewable in a diff — the whole point of moving them is to make the
 * prose easier to work with, not harder.
 */
export const PAGE_CONTRACT_VERSION = 1;

export const pageSchema = z.object({
  contractVersion: z.literal(PAGE_CONTRACT_VERSION),
  /** Matches the route segment: `methodology` → `/methodology`. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  /** `<title>` (before the site-name template). */
  title: z.string().min(1),
  /** Meta description. */
  description: z.string().min(1).max(300),
  /**
   * Small label above the h1. Optional: a converted page must be able to
   * reproduce its original rendering exactly, and not every page had one.
   */
  eyebrow: z.string().min(1).optional(),
  /** The h1 itself — distinct from `title`, which is written for search results. */
  heading: z.string().min(1),
  /**
   * Lede paragraph, rendered larger than the body. Optional for the same reason
   * as `eyebrow` — inventing an opening paragraph for a legal page during a
   * mechanical conversion would be a content change disguised as a refactor.
   */
  lede: z.string().min(1).optional(),
  /** ISO date, shown as "last updated" on the legal pages. */
  updatedAt: z.string(),
  /** Body as Markdown, rendered through `Prose` — never as raw HTML. */
  bodyMarkdown: z.string().min(1),
  locale: z.string().min(1).optional(),
  translation: translationMetaSchema.optional(),
});

export type PageDoc = z.infer<typeof pageSchema>;
