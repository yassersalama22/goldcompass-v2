import type { NewsletterProvider, SubscribeResult } from "./provider";

const ENDPOINT = "https://api.buttondown.email/v1/subscribers";

/**
 * Buttondown provider. Uses the REST API directly (no SDK) — consistent with
 * the CoinGecko provider. The list lives in Buttondown, so we keep no DB.
 *
 * Docs: https://docs.buttondown.email/api-subscribers-create
 */
export function createButtondownProvider(apiKey: string): NewsletterProvider {
  return {
    name: "Buttondown",
    async subscribe(email, meta): Promise<SubscribeResult> {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: email,
            tags: ["goldcompass-web"],
            metadata: meta?.source ? { source: meta.source } : undefined,
          }),
        });

        if (res.status === 201 || res.status === 200) {
          return { ok: true, status: "subscribed" };
        }

        // Buttondown returns 400 with a code when the email already exists.
        const body = await res.text();
        if (res.status === 400 && /already|exists|subscribed/i.test(body)) {
          return { ok: true, status: "already_subscribed" };
        }

        return {
          ok: false,
          error: "provider_error",
          message: `Buttondown responded ${res.status}`,
        };
      } catch (err) {
        return {
          ok: false,
          error: "provider_error",
          message: (err as Error).message,
        };
      }
    },
  };
}
