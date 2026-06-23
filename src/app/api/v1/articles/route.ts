import { NextResponse } from "next/server";

import { getAllArticles } from "@/server/articles";
import { toArticleSummary } from "@/types/article";

/**
 * Public API: GET /api/v1/articles
 *
 * Returns published article summaries (no body) for non-web clients. Full body
 * is at GET /api/v1/articles/{slug}. Same data-access layer as the website.
 */
export const revalidate = 3600;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  const data = getAllArticles().map(toArticleSummary);
  return NextResponse.json(
    { data },
    { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
  );
}
