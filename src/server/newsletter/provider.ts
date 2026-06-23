/**
 * Provider abstraction for the newsletter / email-capture backend. The
 * subscribe API route depends on this interface, not on any specific service —
 * so Buttondown can be swapped for Mailchimp/etc. without touching callers
 * (mirrors `PriceProvider` and the LLM generator abstractions).
 */
export type SubscribeResult =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | { ok: false; error: "provider_error"; message: string };

export interface NewsletterProvider {
  readonly name: string;
  /**
   * Subscribe an email. `email` is already validated by the caller.
   * Should never throw — return a `provider_error` result instead.
   */
  subscribe(email: string, meta?: { source?: string }): Promise<SubscribeResult>;
}
