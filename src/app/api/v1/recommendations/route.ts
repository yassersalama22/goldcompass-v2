import { NextResponse } from "next/server";

import { getPublishedOutlook } from "@/server/outlook";

/**
 * Public API: GET /api/v1/recommendations
 *
 * Returns the current published gold outlook (recommendations + analysis) as
 * JSON, for any non-web client (e.g. a future mobile app). Reads through the
 * same data-access layer the website uses — single source of truth.
 *
 * Cache-friendly + CORS-enabled (public, read-only).
 */

// Allow ISR-style caching of this response at the edge/CDN.
export const revalidate = 1800;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  const report = getPublishedOutlook();

  if (!report) {
    return NextResponse.json(
      { error: "No published outlook available." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { data: report },
    { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
  );
}
