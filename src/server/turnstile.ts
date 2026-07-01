import "server-only";

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Mirrors the newsletter/price provider pattern: when `TURNSTILE_SECRET_KEY` is
 * unset the check is **inert** (returns ok) so local dev and CI work offline
 * without keys. Set the secret in production to enforce it. The token is proof
 * the request came from the real form widget, not a script hitting the JSON
 * endpoint directly — so verification must happen on the server, not just by
 * rendering the widget client-side.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // inert — not configured

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
