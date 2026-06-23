import type { NewsletterProvider } from "./provider";

/**
 * Inert fallback used when no newsletter API key is configured (local dev / CI /
 * pre-launch) — mirrors the mock LLM generators. Logs the attempt and reports
 * success so the form works end-to-end, but stores nothing.
 */
export const inertNewsletterProvider: NewsletterProvider = {
  name: "Inert (no provider configured)",
  async subscribe(email, meta) {
    console.log(`[newsletter] inert subscribe: ${email}${meta?.source ? ` (source=${meta.source})` : ""}`);
    return { ok: true, status: "subscribed" };
  },
};
