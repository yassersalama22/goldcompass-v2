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
 */
const TOOLS = ["gold-break-even", "gold-karat-price", "gold-profit-loss", "gold-unit-converter"];
const decode = (s) => s.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
let total = 0, matched = 0;
for (const tool of TOOLS) {
  const html = await (await fetch(`http://localhost:3120/calculator/${tool}`)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean)
    // JsonLd emits ONE script holding an array of schemas, not one per schema.
    .flat();
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  if (!faq) { console.log(`${tool.padEnd(22)} NO FAQPage`); continue; }
  const text = decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, " "));
  const missing = [];
  for (const q of faq.mainEntity) {
    total += 2;
    if (text.includes(q.name)) matched++; else missing.push(`Q: ${q.name.slice(0,45)}`);
    if (text.includes(q.acceptedAnswer.text)) matched++; else missing.push(`A: ${q.name.slice(0,45)}`);
  }
  console.log(`${tool.padEnd(22)} ${faq.mainEntity.length} Q&A${missing.length ? "  MISSING: " + missing.join("; ") : "  all present in visible text"}`);
}
console.log(`\n${matched}/${total} FAQ strings appear in both the JSON-LD and the visible page.`);
process.exit(matched === total ? 0 : 1);
