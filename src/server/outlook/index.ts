import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_LOCALE } from "@/config/locales";
import currentOutlookJson from "@/content/outlook/current.json";
import { outlookReportSchema, type OutlookReport } from "@/types/outlook";

/**
 * Outlook data-access layer (headless core).
 *
 * Single source of truth for outlook/recommendations data. The website (Server
 * Components) and the public `/api/v1` route both go through here — never read
 * the artifact directly. Today the artifact is a committed JSON file
 * (Git-as-CMS); swapping to S3/DB later only changes this module.
 *
 * The canonical (English) artifact is imported statically, so it is bundled and
 * always available. Translations live at `src/content/outlook/<locale>/` and are
 * read from disk, because the set of locales is data rather than something the
 * bundler can enumerate — `outputFileTracingIncludes` in `next.config.ts` carries
 * them into the standalone build.
 */

const OUTLOOK_DIR = path.join(process.cwd(), "src", "content", "outlook");

/** Load + validate the canonical outlook artifact. Cached per request. */
export const getCurrentOutlook = cache((): OutlookReport => {
  // zod validates the artifact shape (and validates pipeline output too).
  return outlookReportSchema.parse(currentOutlookJson);
});

/**
 * The outlook in `locale`, or `null` if that locale has no translation.
 *
 * Deliberately does NOT fall back to English: callers need to know the
 * difference so they can decide what to advertise. Rendering the English text
 * under an `/ar/` URL while hreflang claims an Arabic translation exists is how
 * you get the wrong language served to the wrong audience in search results.
 * `getOutlookFor` below is the fallback-aware accessor.
 */
export const getTranslatedOutlook = cache((locale: string): OutlookReport | null => {
  if (locale === DEFAULT_LOCALE) return getCurrentOutlook();
  try {
    const raw = fs.readFileSync(
      path.join(OUTLOOK_DIR, locale, "current.json"),
      "utf8",
    );
    return outlookReportSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
});

/**
 * The outlook to render for `locale`, plus whether it is a real translation.
 *
 * `translated: false` means the reader is being shown English on a non-English
 * URL. That is a deliberate, visible fallback — better than a 404 for a reader
 * who arrived from an Arabic link — but the page must then omit itself from
 * hreflang and say so, which is why this returns the flag rather than hiding it.
 */
export const getOutlookFor = cache(
  (locale: string): { report: OutlookReport | null; translated: boolean } => {
    const translated = getTranslatedOutlook(locale);
    if (translated) return { report: translated, translated: true };
    return { report: getCurrentOutlook(), translated: locale === DEFAULT_LOCALE };
  },
);

/** Public read: returns the outlook only if it is published. */
export const getPublishedOutlook = cache(
  (locale: string = DEFAULT_LOCALE): OutlookReport | null => {
    const { report } = getOutlookFor(locale);
    return report?.status === "published" ? report : null;
  },
);

/** Does `locale` have its own published translation of the outlook? */
export const hasOutlookTranslation = cache((locale: string): boolean => {
  const report = getTranslatedOutlook(locale);
  return report !== null && report.status === "published";
});
