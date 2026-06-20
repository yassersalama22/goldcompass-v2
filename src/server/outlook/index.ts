import "server-only";
import { cache } from "react";

import currentOutlookJson from "@/content/outlook/current.json";
import { outlookReportSchema, type OutlookReport } from "@/types/outlook";

/**
 * Outlook data-access layer (headless core).
 *
 * Single source of truth for outlook/recommendations data. The website (Server
 * Components) and the public `/api/v1` route both go through here — never read
 * the artifact directly. Today the artifact is a committed JSON file
 * (Git-as-CMS); swapping to S3/DB later only changes this module.
 */

/** Load + validate the current outlook artifact. Cached per request. */
export const getCurrentOutlook = cache((): OutlookReport => {
  // zod validates the artifact shape (and will validate pipeline output later).
  return outlookReportSchema.parse(currentOutlookJson);
});

/** Public read: returns the outlook only if it is published. */
export const getPublishedOutlook = cache((): OutlookReport | null => {
  const report = getCurrentOutlook();
  return report.status === "published" ? report : null;
});
