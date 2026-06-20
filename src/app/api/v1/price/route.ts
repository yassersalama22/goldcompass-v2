import { NextResponse } from "next/server";

import { getGoldQuote, getGoldSeries30d } from "@/server/price";

/**
 * Public API: GET /api/v1/price
 *
 * Current gold quote + 30-day series, via the shared price data-access layer.
 * Cache-friendly + CORS-enabled for non-web clients (e.g. future mobile app).
 */
export const revalidate = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const [quote, series] = await Promise.all([
    getGoldQuote(),
    getGoldSeries30d(),
  ]);

  if (!quote.ok && !series.ok) {
    return NextResponse.json(
      { error: "Price data temporarily unavailable." },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      data: {
        quote: quote.data,
        series: series.data,
      },
      meta: {
        fetchedAt: quote.fetchedAt,
        stale: quote.stale || series.stale,
      },
    },
    { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
  );
}
