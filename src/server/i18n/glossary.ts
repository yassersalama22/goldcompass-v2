import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

/**
 * Per-locale termbase.
 *
 * This is the highest-leverage artifact in the translation system. A financial
 * page gets terminology wrong in ways a fluent-but-non-specialist reader will
 * not notice and a specialist will not forgive — "break-even", "real yield" and
 * "invalidation level" all have specific renderings that a general-purpose model
 * will otherwise vary between runs.
 *
 * Reviewing ~80 terms once, carefully, buys consistency for every article that
 * follows, and it is what makes a language nobody here reads tractable: the
 * expensive human judgement happens here, and `i18n:check` enforces it
 * mechanically afterwards.
 */
const glossaryTermSchema = z.object({
  /** The English term as it appears in source copy. Matched case-insensitively. */
  en: z.string().min(1),
  /** The approved rendering. What the prompt instructs the model to use. */
  ar: z.string().min(1).optional(),
  /** Approved rendering, generic key — `ar` above is kept for readability. */
  target: z.string().min(1).optional(),
  /**
   * Other acceptable forms. Arabic inflects heavily (definite article,
   * plurals, agreement), so a single string would fail the compliance check on
   * perfectly good prose. These are alternatives the check accepts, not
   * alternatives the model is encouraged to pick.
   */
  variants: z.array(z.string()).optional(),
});

export const glossarySchema = z.object({
  locale: z.string().min(1),
  note: z.string().optional(),
  /**
   * Terms that must survive verbatim: institutions, tickers, our own brand.
   * Translating "PAXG" or "FOMC" produces text that cannot be looked up.
   */
  doNotTranslate: z.array(z.string()),
  terms: z.array(glossaryTermSchema),
});

export type Glossary = z.infer<typeof glossarySchema>;

export type GlossaryEntry = {
  en: string;
  target: string;
  /** Every acceptable target form, including `target` itself. */
  accepted: string[];
};

const GLOSSARY_DIR = path.join(process.cwd(), "src", "content", "i18n", "glossary");

/**
 * Load a locale's glossary. Returns `null` when there is none — a locale can be
 * routed before its termbase is written, and the translator degrades to
 * "no enforced terminology" rather than refusing to run.
 */
export function loadGlossary(locale: string): Glossary | null {
  const file = path.join(GLOSSARY_DIR, `${locale}.json`);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  return glossarySchema.parse(JSON.parse(raw));
}

/** Normalised entries, with the per-locale key (`ar`) resolved to `target`. */
export function glossaryEntries(glossary: Glossary): GlossaryEntry[] {
  return glossary.terms.map((term) => {
    const target = term.target ?? term.ar;
    if (!target) {
      throw new Error(`Glossary term "${term.en}" has no target rendering.`);
    }
    return {
      en: term.en,
      target,
      accepted: [target, ...(term.variants ?? [])],
    };
  });
}

/**
 * Render the glossary for the prompt.
 *
 * Only the terms actually present in the text being translated are included.
 * The full list is ~80 entries; sending all of them on every call wastes tokens
 * and, worse, buries the handful that matter for this particular piece.
 */
export function glossaryForText(
  glossary: Glossary,
  text: string,
): GlossaryEntry[] {
  const haystack = text.toLowerCase();
  return glossaryEntries(glossary).filter((entry) =>
    haystack.includes(entry.en.toLowerCase()),
  );
}
