import { siteConfig } from "@/config/site";

/**
 * robots.txt, hand-written rather than via Next's `robots.ts` metadata route.
 *
 * `MetadataRoute.Robots` can only emit the directives it models (User-agent,
 * Allow/Disallow, Sitemap, Host) — it has no escape hatch for `Content-Signal`,
 * so the metadata route cannot express our AI-usage preferences at all. The
 * alternative was injecting the line at the edge with a Cloudflare Transform
 * Rule, which would leave the policy undiscoverable in git.
 *
 * Content Signals (https://contentsignals.org/, IETF draft-romm-aipref-
 * contentsignals) declares how we want this content used, per user-agent group.
 * Our position:
 *   - ai-train=no   — training foundation models on our analysis returns
 *                     nothing to us and is the one use with no attribution path.
 *   - search=yes    — organic search is the entire acquisition channel.
 *   - ai-input=yes  — being cited inside AI answers is the successor to that,
 *                     so grounding/RAG retrieval is explicitly welcome.
 *
 * Note these are declarations of preference, not access control: they are
 * unenforced by themselves. Enforcement, if ever wanted, is Disallow rules or
 * Cloudflare AI Crawl Control.
 */
const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";

const BODY = `# GoldCompass — https://goldcompass.app
#
# Content-Signal declares how this site's content may be used.
# See https://contentsignals.org/ for the full definitions.
#   ai-train=no    Do not use this content to train or fine-tune AI models.
#   search=yes     Indexing for search results is welcome.
#   ai-input=yes   Using this content to ground AI answers is welcome.

User-Agent: *
Content-Signal: ${CONTENT_SIGNAL}
Allow: /

Host: ${siteConfig.url}
Sitemap: ${siteConfig.url}/sitemap.xml
`;

// Prerendered at build like the metadata route it replaces — the body is
// static, so there is nothing to revalidate.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
