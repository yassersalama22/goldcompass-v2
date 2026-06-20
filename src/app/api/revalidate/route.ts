import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * On-demand revalidation: POST /api/revalidate?secret=...&path=/outlook
 *
 * Lets the publish step (or a deploy hook) refresh specific static pages
 * immediately instead of waiting for the ISR window. Secret-protected via the
 * REVALIDATE_SECRET env var. Defaults to revalidating the outlook + home pages.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-revalidate-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathParam = request.nextUrl.searchParams.get("path");
  const paths = pathParam ? [pathParam] : ["/outlook", "/"];
  for (const p of paths) revalidatePath(p);

  return NextResponse.json({ revalidated: true, paths });
}
