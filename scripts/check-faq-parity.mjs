/**
 * FAQ JSON-LD must match the visible page text.
 *
 *   npm run build && (cd .next/standalone && PORT=3120 node server.js) &
 *   npm run check:faq
 *
 * Google requires marked-up FAQ content to be visible on the page, and mismatched
 * markup is a structured-data violation rather than a cosmetic problem. The whole
 * reason `ToolPageShell` takes a single `faqs` array — rendered AND passed to
 * `faqSchema()` — is to make drift impossible; this proves it stayed that way
 * after the copy moved into the UI catalog.
 *
 * `/calculator` is covered too: its FAQ is built by `calculatorFaqSchema()`
 * through the sync `messages()` accessor rather than from the rendered array, so
 * it CAN drift — and did: `/ar/calculator` shipped English JSON-LD under Arabic
 * FAQs because the Arabic catalog was not registered in `messages.ts`.
 *
 * FAQ_LOCALES=en,ar checks the Arabic pages as well (the server must be
 * running with that locale enabled).
 */
const PAGES = ["", "/gold-break-even", "/gold-karat-price", "/gold-profit-loss", "/gold-unit-converter"]
  .map((p) => `/calculator${p}`);
const LOCALES = (process.env.FAQ_LOCALES ?? "en").split(",");
const BASE = process.env.BASE ?? "http://localhost:3120";
const decode = (s) => s.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
let total = 0, matched = 0;
for (const tool of LOCALES.flatMap((l) => PAGES.map((p) => (l === "en" ? p : `/${l}${p}`)))) {
  const html = await (await fetch(BASE + tool)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean)
    // JsonLd emits ONE script holding an array of schemas, not one per schema.
    .flat();
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  if (!faq) { console.log(`${tool.padEnd(36)} NO FAQPage`); continue; }
  const text = decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, " "));
  const missing = [];
  for (const q of faq.mainEntity) {
    total += 2;
    if (text.includes(q.name)) matched++; else missing.push(`Q: ${q.name.slice(0,45)}`);
    if (text.includes(q.acceptedAnswer.text)) matched++; else missing.push(`A: ${q.name.slice(0,45)}`);
  }
  console.log(`${tool.padEnd(36)} ${faq.mainEntity.length} Q&A${missing.length ? "  MISSING: " + missing.join("; ") : "  all present in visible text"}`);
}
console.log(`\n${matched}/${total} FAQ strings appear in both the JSON-LD and the visible page.`);
process.exit(matched === total ? 0 : 1);
