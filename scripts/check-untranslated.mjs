/**
 * Find English text left on translated pages.
 *
 *   NEXT_PUBLIC_LOCALES_ENABLED=en,ar npm run build
 *   (cd .next/standalone && NEXT_PUBLIC_LOCALES_ENABLED=en,ar PORT=3120 node server.js) &
 *   npm run check:untranslated                 # default /ar pages
 *   PAGES=/ar,/ar/outlook npm run check:untranslated
 *
 * `check:rtl` proves a page LAYS OUT correctly in Arabic; it cannot tell
 * whether the words are Arabic. This script can: it fetches each page, strips
 * markup, and reports every text chunk (plus aria-label / title / placeholder /
 * alt) that contains Latin-script words and no Arabic at all. That is how the
 * 2026-10-10 audit found ~20 components of hardcoded English chrome that every
 * other gate had passed.
 *
 * A chunk with ANY Arabic in it is not reported — mixed text like
 * "يتتبع PAXG" is correct. Brand names, tickers and units are allowlisted.
 *
 * Reports, never fails by default: until Phase E, artifact content (outlook
 * body, articles) is legitimately English. `STRICT=1` exits non-zero on any
 * finding, for use once a locale is fully translated.
 */
const BASE = process.env.BASE ?? "http://localhost:3120";
const PAGES = process.env.PAGES
  ? process.env.PAGES.split(",")
  : [
      "/ar",
      "/ar/outlook",
      "/ar/trends",
      "/ar/insights",
      "/ar/insights/explainers",
      "/ar/calculator",
      "/ar/calculator/gold-break-even",
      "/ar/about",
      "/ar/methodology",
      "/ar/ai-disclosure",
      "/ar/disclaimer",
      "/ar/subscribed",
    ];

/** Words that are correct in any language: brands, tickers, units, formats. */
const ALLOW = new Set(
  (
    "GoldCompass CoinGecko PAXG PAX Gold FRED XAU USD DXY ICE HTML Markdown API " +
    "RSS AI LLM Buttondown Cloudflare Turnstile URL JSON ozt oz kg Geist UTC"
  ).split(" "),
);
/** Whole chunks that are language-neutral (an email example reads the same everywhere). */
const ALLOW_CHUNKS = new Set(["you@example.com"]);

const ARABIC = /[؀-ۿ]/;

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

function englishChunks(html) {
  const body = html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, "");
  const attrs = [...body.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map(
    (m) => decode(m[1]),
  );
  const text = body
    .replace(/<(p|li|h[1-6]|dt|dd|div|td|th|label|button|a|span)[\s>]/g, "\n$&")
    .replace(/<[^>]+>/g, "\n");
  const chunks = [...decode(text).split("\n"), ...attrs]
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const found = [];
  for (const chunk of chunks) {
    if (ARABIC.test(chunk) || ALLOW_CHUNKS.has(chunk)) continue;
    const words = (chunk.match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).filter((w) => !ALLOW.has(w));
    // One stray word ("as", "for") is usually a fragment of a mixed sentence
    // split by inline markup; two or more is a real untranslated string.
    if (words.length >= 2 && !found.includes(chunk)) found.push(chunk);
  }
  return found;
}

let total = 0;
for (const path of PAGES) {
  const res = await fetch(BASE + path);
  if (!res.ok) {
    console.log(`\n=== ${path}  HTTP ${res.status}`);
    total++;
    continue;
  }
  const found = englishChunks(await res.text());
  total += found.length;
  console.log(`\n=== ${path}  (${found.length} English chunk${found.length === 1 ? "" : "s"})`);
  for (const chunk of found) console.log(`    ${chunk.slice(0, 120)}`);
}

console.log(`\n${total} untranslated chunk(s) across ${PAGES.length} page(s).`);
process.exit(process.env.STRICT && total > 0 ? 1 : 0);
