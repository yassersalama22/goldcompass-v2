import { z } from "zod";

/**
 * Translation metadata carried by a translated artifact.
 *
 * Added after both content contracts shipped at version 1, and **optional** in
 * both, so `/api/v1` consumers that predate it are unaffected — the same
 * additive move as `macro` on the outlook and `kind` on articles.
 */
export const translationMetaSchema = z.object({
  /** Locale this artifact was translated *from*. Always the canonical locale. */
  sourceLocale: z.string().min(1),
  /**
   * Hash of the source artifact's **translatable fields only** (see
   * `field-map.ts`).
   *
   * Scoped that narrowly on purpose. A change to `updatedAt` or `status` on the
   * English original must not invalidate a good translation and force a
   * re-spend; a change to a single sentence of prose must. Comparing this to a
   * freshly computed hash is how `i18n:check` proves a translation is current
   * rather than quietly stale.
   */
  sourceHash: z.string().min(1),
  translatedAt: z.string(),
  /** Model identifier, for auditing a bad batch after the fact. */
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  /**
   * How this translation was cleared for publication.
   *
   *  - `native`    — a fluent speaker read it.
   *  - `automated` — it passed `i18n:check` and the back-translation review, and
   *                  nobody who reads the language has seen it.
   *
   * This drives the disclosure shown on the page. It exists because the honest
   * answer differs per locale, and a reader on a YMYL page is entitled to it.
   */
  review: z.enum(["native", "automated"]),
});
export type TranslationMeta = z.infer<typeof translationMetaSchema>;
