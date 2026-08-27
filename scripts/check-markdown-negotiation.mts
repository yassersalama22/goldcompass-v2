/**
 * Guards the `Accept: text/markdown` negotiation rules — `npm run check:markdown`.
 *
 * This is the one piece of the markdown-for-agents feature that can hurt real
 * users or search rankings if it is wrong: match too loosely and browsers and
 * Googlebot get served Markdown instead of the page. The browser/crawler cases
 * below are the actual `Accept` headers those clients send, so a regression in
 * `prefersMarkdown` fails here rather than in production.
 *
 * Run alongside `next build` and `eslint` when touching `src/lib/agent-markdown.ts`,
 * `src/proxy.ts`, or the markdown route handler.
 */
import assert from "node:assert/strict";

import {
  hasMarkdownRepresentation,
  prefersMarkdown,
} from "@/lib/agent-markdown";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${label}`);
    console.error(`       ${(err as Error).message.split("\n")[0]}`);
  }
}

/** Accept headers real browsers and search crawlers send. None may match. */
const MUST_SERVE_HTML: [string, string | null][] = [
  ["Googlebot", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"],
  [
    "Chrome navigation",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  ],
  ["Safari", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"],
  ["Bingbot", "text/html, application/xhtml+xml, */*"],
  ["curl / fetch default", "*/*"],
  ["wildcard text range", "text/*"],
  ["no Accept header", null],
  ["empty Accept header", ""],
  ["explicitly prefers HTML", "text/html,text/markdown;q=0.9"],
  ["markdown marked unacceptable", "text/markdown;q=0,text/html"],
  ["JSON client", "application/json"],
  ["substring trap", "text/markdownish"],
];

/** Agents that explicitly ask for Markdown. All must match. */
const MUST_SERVE_MARKDOWN: [string, string][] = [
  ["bare", "text/markdown"],
  ["with charset parameter", "text/markdown; charset=utf-8"],
  ["markdown then wildcard", "text/markdown, */*"],
  ["markdown preferred over html", "text/markdown,text/html;q=0.9"],
  ["equal q with html", "text/html;q=1.0,text/markdown;q=1.0"],
  ["uppercase", "TEXT/MARKDOWN"],
  ["extra whitespace", "  text/markdown ,  application/json  "],
  ["explicit q=1", "text/markdown;q=1"],
];

/** Routes backed by the data-access layer, so a Markdown twin cannot drift. */
const HAS_MARKDOWN = [
  "/",
  "/outlook",
  "/trends",
  "/insights",
  "/insights/explainers",
  "/insights/market-updates",
  "/insights/some-article-slug",
  // Its body lives in `src/content/pages/disclaimer.md`, so the Markdown served
  // IS the source rather than a hand-maintained copy of a JSX page.
  "/disclaimer",
];

/**
 * Designed layouts, interactive tools, feeds and the API: HTML/native only.
 *
 * `/about`, `/methodology` and `/ai-disclosure` are card grids, definition
 * lists and styled step sequences rather than prose documents, so they keep
 * their JSX and fall through to HTML — a valid negotiation outcome.
 */
const FALLS_THROUGH = [
  "/about",
  "/methodology",
  "/ai-disclosure",
  "/subscribed",
  "/calculator",
  "/calculator/gold-break-even",
  "/insights/rss.xml",
  "/api/v1/price",
  "/llms.txt",
];

console.log("\nMust serve HTML (browsers + search crawlers):");
for (const [label, header] of MUST_SERVE_HTML) {
  check(label, () => assert.equal(prefersMarkdown(header), false));
}

console.log("\nMust serve Markdown (agents asking explicitly):");
for (const [label, header] of MUST_SERVE_MARKDOWN) {
  check(label, () => assert.equal(prefersMarkdown(header), true));
}

console.log("\nRoutes with a Markdown representation:");
for (const path of HAS_MARKDOWN) {
  check(path, () => assert.equal(hasMarkdownRepresentation(path), true));
}

console.log("\nRoutes that fall through to their normal response:");
for (const path of FALLS_THROUGH) {
  check(path, () => assert.equal(hasMarkdownRepresentation(path), false));
}

console.log(
  `\n${passed} passed, ${failed} failed (${passed + failed} assertions).\n`,
);
process.exit(failed === 0 ? 0 : 1);
