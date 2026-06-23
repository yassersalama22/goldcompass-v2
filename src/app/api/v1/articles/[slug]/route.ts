import { NextResponse } from "next/server";

import { getArticleBySlug } from "@/server/articles";

/** Public API: GET /api/v1/articles/{slug} — full published article. */
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return NextResponse.json(
      { error: "Article not found." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { data: article },
    { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
  );
}
