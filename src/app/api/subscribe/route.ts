import { NextResponse } from "next/server";
import { z } from "zod";

import { getNewsletterProvider } from "@/server/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  // Honeypot: real users leave this blank; bots tend to fill every field.
  company: z.string().optional(),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
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
