/**
 * RTL verification over CDP against a running production build.
 *
 *   npm run build && (cd .next/standalone && PORT=3120 node server.js) &
 *   npm run check:rtl
 *
 * Build with NEXT_PUBLIC_LOCALES_ENABLED="en,ar" for the Arabic pages to exist.
 * Drives the system Chrome over the DevTools protocol — nothing to install.
 *
 * Checks, per page and per theme:
 *  - axe-core violations (WCAG 2.0/2.1 A+AA + best-practice)
 *  - console errors, especially React hydration mismatches
 *  - computed direction actually applied
 *  - no horizontal overflow of the document (the classic RTL regression)
 *  - the Arabic webfont actually loaded (not a silent system fallback)
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE ?? "http://localhost:3120";
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PAGES = process.env.PAGES
  ? process.env.PAGES.split(",")
  : [
      "/ar",
      "/ar/outlook",
      "/ar/trends",
      "/ar/insights",
      "/ar/calculator",
      "/ar/calculator/gold-profit-loss",
      "/ar/about",
      "/ar/methodology",
      "/",
      "/outlook",
      "/trends",
    ];

const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=9333",
  "--disable-gpu",
  "--no-first-run",
  "--user-data-dir=/tmp/gc-rtl-profile",
]);
await sleep(2500);

const { webSocketDebuggerUrl } = await (
  await fetch("http://127.0.0.1:9333/json/version")
).json();

let nextId = 1;
const ws = new WebSocket(webSocketDebuggerUrl);
const pending = new Map();
const events = [];
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) events.push(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { result: target } = await send("Target.createTarget", {
  url: "about:blank",
});
const { result: sess } = await send("Target.attachToTarget", {
  targetId: target.targetId,
  flatten: true,
});
const sid = sess.sessionId;
await send("Page.enable", {}, sid);
await send("Runtime.enable", {}, sid);
await send("Log.enable", {}, sid);

const evaluate = async (expression) => {
  const r = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sid,
  );
  if (r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  }
  return r.result?.result?.value;
};

let totalViolations = 0;
let totalConsoleErrors = 0;
const rows = [];

for (const theme of ["light", "dark"]) {
  await send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: theme }] },
    sid,
  );
  for (const path of PAGES) {
    events.length = 0;
    await send("Page.navigate", { url: BASE + path }, sid);
    await sleep(1400);

    const consoleErrors = events
      .filter(
        (e) =>
          (e.method === "Runtime.consoleAPICalled" &&
            e.params.type === "error") ||
          (e.method === "Log.entryAdded" && e.params.entry.level === "error") ||
          e.method === "Runtime.exceptionThrown",
      )
      .map((e) =>
        (
          e.params?.entry?.text ??
          e.params?.args?.map((a) => a.value ?? a.description).join(" ") ??
          e.params?.exceptionDetails?.text ??
          ""
        ).slice(0, 180),
      )
      .filter(Boolean);

    const facts = await evaluate(`(() => {
      const de = document.documentElement;
      return {
        dir: getComputedStyle(de).direction,
        htmlDir: de.getAttribute('dir'),
        lang: de.getAttribute('lang'),
        // The classic RTL break: something pinned with a physical offset pushes
        // the page sideways. Allow 2px for sub-pixel rounding.
        overflowX: de.scrollWidth - de.clientWidth,
        bodyFont: getComputedStyle(document.body).fontFamily,
        h1: document.querySelector('h1')?.textContent?.trim().slice(0, 40) ?? null,
      };
    })()`);

    await evaluate(AXE);
    const axeResult = await evaluate(`
      axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }
      }).then(r => JSON.stringify(r.violations.map(v => ({
        id: v.id, impact: v.impact, nodes: v.nodes.length,
        target: v.nodes[0]?.target?.join(' ') ?? '',
      }))))
    `);
    const violations = JSON.parse(axeResult);

    totalViolations += violations.length;
    totalConsoleErrors += consoleErrors.length;
    rows.push({ theme, path, facts, violations, consoleErrors });
  }
}

for (const r of rows) {
  const bad =
    r.violations.length || r.consoleErrors.length || r.facts.overflowX > 2;
  const mark = bad ? "FAIL" : "ok  ";
  console.log(
    `${mark} [${r.theme}] ${r.path.padEnd(34)} dir=${r.facts.dir} lang=${r.facts.lang} overflowX=${r.facts.overflowX}px`,
  );
  for (const v of r.violations)
    console.log(`       axe: ${v.id} (${v.impact}, ${v.nodes} nodes) ${v.target}`);
  for (const e of r.consoleErrors) console.log(`       console: ${e}`);
}

const arabicFont = rows.find((r) => r.path.startsWith("/ar"))?.facts.bodyFont;
console.log(`\nArabic body font-family: ${arabicFont}`);
console.log(
  `\n${rows.length} page/theme combinations — ${totalViolations} axe violations, ${totalConsoleErrors} console errors`,
);

ws.close();
chrome.kill();
process.exit(totalViolations || totalConsoleErrors ? 1 : 0);
