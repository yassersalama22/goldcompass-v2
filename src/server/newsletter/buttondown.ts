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
          // Fail fast if Buttondown hangs — otherwise the whole /api/subscribe
          // request stalls until the proxy (Cloudflare 524) kills it with an
          // HTML error page the form can't parse.
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 201 || res.status === 200) {
          return { ok: true, status: "subscribed" };
        }

        // Buttondown signals failures with a structured `code`. Match on that
        // rather than substring-matching the raw body: "subscriber_blocked"
        // (firewall) contains "subscriber", which a loose /subscribed/ test
        // very nearly treats as an already-subscribed success.
        const body = await res.text();
        let code: string | undefined;
        try {
          code = (JSON.parse(body) as { code?: string }).code;
        } catch {
          // Non-JSON body (proxy error page) — fall through to provider_error.
        }

        if (code === "email_already_exists") {
          return { ok: true, status: "already_subscribed" };
        }

        // Surface the real reason server-side; the route returns a generic
        // message to the client, so this log is the only diagnostic there is.
        console.error(
          `[newsletter] Buttondown ${res.status}${code ? ` ${code}` : ""}: ${body.slice(0, 300)}`,
        );

        return {
          ok: false,
          error: "provider_error",
          message: `Buttondown responded ${res.status}${code ? ` (${code})` : ""}`,
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
