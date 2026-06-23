import "server-only";

import { createButtondownProvider } from "./buttondown";
import { inertNewsletterProvider } from "./inert";
import type { NewsletterProvider } from "./provider";

export type { NewsletterProvider, SubscribeResult } from "./provider";

/**
 * Select the newsletter provider from env. Buttondown when BUTTONDOWN_API_KEY
 * is set, otherwise the inert fallback (so dev/CI/pre-launch builds work with
 * no external dependency). Set NEWSLETTER_PROVIDER=inert to force the fallback.
 */
export function getNewsletterProvider(): NewsletterProvider {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (key && process.env.NEWSLETTER_PROVIDER !== "inert") {
    return createButtondownProvider(key);
  }
  return inertNewsletterProvider;
}
