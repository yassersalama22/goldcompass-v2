/**
 * Verify every translated artifact against its English source.
 *
 *   npm run i18n:check
 *
 * Runs in CI on any PR touching `src/content/**`. This is the gate that makes a
 * translation trustworthy without reading the language: numbers, URLs, Markdown
 * structure, terminology, currency unit, length and freshness are all checked
 * mechanically. It cannot check meaning — that is what native review and the
 * back-translation pass are for.
 *
 * `--self-test` additionally runs fixtures that mutate a good translation in
 * each of the ways that matter, and fails if the checker does not notice. A
 * gate nobody has seen fail is not known to work.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { LOCALES, requireLocale, type LocaleDef } from "@/config/locales";
import { checkTranslation, type Finding } from "@/server/i18n/check";
import { articleFields, hashFields, outlookFields } from "@/server/i18n/field-map";
import { articleSchema, type Article } from "@/types/article";
import { outlookReportSchema, type OutlookReport } from "@/types/outlook";

const CONTENT = path.join(process.cwd(), "src", "content");
const NON_CANONICAL = LOCALES.filter((l) => !l.canonical);

let errors = 0;
let warnings = 0;
let checked = 0;

function report(label: string, findings: Finding[]) {
  checked++;
  const errs = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warning");
  errors += errs.length;
  warnings += warns.length;
  if (findings.length === 0) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  ${errs.length ? "FAIL" : "warn"}  ${label}`);
  for (const f of findings) {
    console.log(`          ${f.severity === "error" ? "✗" : "!"} ${f.path}: ${f.message}`);
  }
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function checkOutlook(locale: LocaleDef) {
  const raw = await readJson(path.join(CONTENT, "outlook", locale.code, "current.json"));
  if (!raw) return;
  const source: OutlookReport = outlookReportSchema.parse(
    JSON.parse(await readFile(path.join(CONTENT, "outlook", "current.json"), "utf8")),
  );
  const translated = outlookReportSchema.parse(raw);
  report(
    `${locale.code}/outlook/current.json`,
    checkTranslation({
      label: `outlook (${locale.code})`,
      locale: locale.code,
      sourceFields: outlookFields(source),
      translatedFields: outlookFields(translated),
      source: source as unknown as Record<string, unknown>,
      translated: translated as unknown as Record<string, unknown>,
      storedHash: translated.translation?.sourceHash,
    }),
  );
}

async function checkArticles(locale: LocaleDef) {
  const dir = path.join(CONTENT, "articles", locale.code);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }
  for (const file of files) {
    const sourceRaw = await readJson(path.join(CONTENT, "articles", file));
    if (!sourceRaw) {
      console.log(`  FAIL  ${locale.code}/articles/${file}`);
      console.log(`          ✗ <artifact>: no English source with this filename`);
      errors++;
      checked++;
      continue;
    }
    const source: Article = articleSchema.parse(sourceRaw);
    const translated: Article = articleSchema.parse(await readJson(path.join(dir, file)));
    report(
      `${locale.code}/articles/${file}`,
      checkTranslation({
        label: `${file} (${locale.code})`,
        locale: locale.code,
        sourceFields: articleFields(source),
        translatedFields: articleFields(translated),
        source: source as unknown as Record<string, unknown>,
        translated: translated as unknown as Record<string, unknown>,
        storedHash: translated.translation?.sourceHash,
      }),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Self-test: prove each rule actually fires                                   */
/* -------------------------------------------------------------------------- */

async function selfTest() {
  console.log("\nSelf-test — each fixture must be REJECTED:");
  const source: OutlookReport = outlookReportSchema.parse(
    JSON.parse(await readFile(path.join(CONTENT, "outlook", "current.json"), "utf8")),
  );
  const locale = "ar";
  const fields = outlookFields(source);

  // A "good" translation baseline: structurally identical to the source, with
  // money reformatted the way the target locale writes it. The prose stays
  // English, so the residue check warns — that is expected and is a warning, not
  // an error. Money must be converted, though: leaving `$4,283.61` on an Arabic
  // artifact is exactly the defect the money rule exists to catch, and an
  // earlier version of this fixture failed here for precisely that reason.
  const good = structuredClone(source);
  const unit = requireLocale(locale).currency.unit;
  good.keyLevels = good.keyLevels.map((level) => ({
    ...level,
    value: level.value.replace(/\$([\d,.]+)/g, `$1 ${unit}`),
  }));
  good.locale = locale;
  good.translation = {
    sourceLocale: "en",
    sourceHash: hashFields(fields),
    translatedAt: new Date().toISOString(),
    model: "fixture",
    promptVersion: "fixture",
    review: "native",
  };

  const run = (mutate: (r: OutlookReport) => void) => {
    const t = structuredClone(good);
    mutate(t);
    return checkTranslation({
      label: "fixture",
      locale,
      sourceFields: fields,
      translatedFields: outlookFields(t),
      source: source as unknown as Record<string, unknown>,
      translated: t as unknown as Record<string, unknown>,
      storedHash: t.translation?.sourceHash,
    }).filter((f) => f.severity === "error");
  };

  const fixtures: [string, (r: OutlookReport) => void][] = [
    ["a changed number in the summary", (r) => { r.summary = r.summary.replace(/\d/, "9"); }],
    ["Arabic-Indic digits", (r) => { r.summary = `٤٢٨٣ ${r.summary}`; }],
    ["a rewritten spot price", (r) => { r.spot.price = 1; }],
    ["an edited source URL", (r) => { if (r.sources[0]) r.sources[0].url = "https://evil.example.com"; }],
    ["an edited citation title", (r) => { if (r.sources[0]) r.sources[0].title = "Changed"; }],
    ["a dropped heading", (r) => { r.analysisMarkdown = r.analysisMarkdown.replace(/^##\s.*$/m, "plain text"); }],
    ["an added markdown link", (r) => { r.analysisMarkdown += "\n\n[extra](https://example.com)"; }],
    ["a truncated body", (r) => { r.analysisMarkdown = r.analysisMarkdown.slice(0, 40); }],
    ["a stale sourceHash", (r) => { r.translation!.sourceHash = "0".repeat(32); }],
    ["a changed signal enum", (r) => { r.calls[0]!.signal = r.calls[0]!.signal === "BUY" ? "SELL" : "BUY"; }],
    ["a key level with its currency unit dropped", (r) => { if (r.keyLevels[0]) r.keyLevels[0].value = r.keyLevels[0].value.replace(unit, "").trim(); }],
  ];

  let missed = 0;
  for (const [name, mutate] of fixtures) {
    const found = run(mutate);
    if (found.length > 0) {
      console.log(`  ok    rejects ${name}`);
    } else {
      console.log(`  FAIL  did NOT reject ${name}`);
      missed++;
    }
  }

  // And the unmutated fixture must pass, or the checker is simply always angry.
  const clean = run(() => {});
  if (clean.length === 0) {
    console.log("  ok    accepts a structurally valid translation");
  } else {
    console.log("  FAIL  rejected a valid translation:");
    for (const f of clean) console.log(`          ✗ ${f.path}: ${f.message}`);
    missed++;
  }

  if (missed > 0) {
    console.error(`\n${missed} self-test failure(s) — the gate is not working.`);
    process.exit(1);
  }
}

async function main() {
  console.log("Translated artifacts:");
  for (const locale of NON_CANONICAL) {
    await checkOutlook(locale);
    await checkArticles(locale);
  }
  if (checked === 0) console.log("  (none yet)");

  if (process.argv.includes("--self-test")) await selfTest();

  console.log(`\n${checked} artifact(s) checked — ${errors} error(s), ${warnings} warning(s).`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[i18n:check] FAILED:", err);
  process.exit(1);
});
