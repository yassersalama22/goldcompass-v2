import { NextResponse } from "next/server";
import { z } from "zod";

import { getNewsletterProvider } from "@/server/newsletter";
import { getClientIp, rateLimit, sweepExpired } from "@/server/rate-limit";
import { verifyTurnstile } from "@/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-IP throttle. Newsletter signup is low-frequency, so a small allowance
// stops scripted abuse (email-bombing arbitrary addresses via double-opt-in
// confirmations, Buttondown quota exhaustion) without hindering real users.
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

const subscribeSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  // Honeypot: real users leave this blank; bots tend to fill every field.
  company: z.string().optional(),
  source: z.string().max(60).optional(),
  // Cloudflare Turnstile token from the form widget. Enforced server-side only
  // when TURNSTILE_SECRET_KEY is configured (see verifyTurnstile).
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  sweepExpired();
  const limit = rateLimit(`subscribe:${getClientIp(request)}`, RATE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // Honeypot tripped → pretend success, store nothing.
  if (parsed.data.company && parsed.data.company.trim() !== "") {
    return NextResponse.json({ ok: true, status: "subscribed" });
  }

  // Cloudflare Turnstile: proves the request came from the real form widget,
  // not a script hitting this endpoint directly. Inert when unconfigured.
  const humanVerified = await verifyTurnstile(
    parsed.data.turnstileToken,
    getClientIp(request),
  );
  if (!humanVerified) {
    return NextResponse.json(
      { ok: false, message: "Verification failed. Please try again." },
      { status: 403 },
    );
  }

  const provider = getNewsletterProvider();
  const result = await provider.subscribe(parsed.data.email, {
    source: parsed.data.source ?? "website",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, status: result.status });
}
