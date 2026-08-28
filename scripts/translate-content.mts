/**
 * Translate published content artifacts into every active non-canonical locale.
 *
 *   npm run i18n:translate              # all locales, all artifacts
 *   TRANSLATE_LOCALE=ar npm run i18n:translate
 *   TRANSLATE_ONLY=outlook npm run i18n:translate     # outlook | articles | catalog
 *
 * Writes siblings under `src/content/<type>/<locale>/`. Artifacts whose source
 * has not changed since the last run are skipped — the stored `sourceHash`
 * covers translatable fields only, so a daily outlook regenerates but an
 * untouched article does not, which is where most of the cost saving is.
 *
 * Does NOT publish. Translations land as drafts and go live through the same
 * PR review gate as the English original.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { TRANSLATION_TARGETS, requireLocale, type LocaleDef } from "@/config/locales";
import {
  applyTranslations,
  articleFields,
  assertFieldMapCoverage,
  hashFields,
  outlookFields,
} from "@/server/i18n/field-map";
import {
  buildMeta,
  planCatalog,
  readCatalog,
  readMeta,
  setPath,
  writeCatalog,
  writeMeta,
} from "@/server/i18n/catalog";
import { catalogFields, hashValue } from "@/server/i18n/field-map";
import { reformatMoney } from "@/server/i18n/money";
import { getTranslationProvider } from "@/server/i18n/translate";
import type { TranslatableField } from "@/server/i18n/field-map";
import type { TranslationProvider } from "@/server/i18n/translate";
import { articleSchema, type Article } from "@/types/article";
import { outlookReportSchema, type OutlookReport } from "@/types/outlook";
import type { TranslationMeta } from "@/types/translation";

const CONTENT = path.join(process.cwd(), "src", "content");

/**
 * Translate the prose, reformat the money deterministically.
 *
 * Money values never reach the model: a regex cannot invent a digit, and these
 * are the numbers a reader would act on. See `server/i18n/money.ts`.
 */
async function translateFields(
  provider: TranslationProvider,
  locale: LocaleDef,
  fields: TranslatableField[],
): Promise<{ values: Record<string, string>; model: string; promptVersion: string }> {
  const money = fields.filter((f) => f.kind === "money");
  const prose = fields.filter((f) => f.kind !== "money");

  const { values, model, promptVersion } = await provider.translate({
    locale,
    fields: prose,
  });

  for (const field of money) {
    values[field.path] = reformatMoney(field.value, locale);
  }

  return { values, model, promptVersion };
}

function meta(
  sourceHash: string,
  model: string,
  promptVersion: string,
  locale: LocaleDef,
): TranslationMeta {
  return {
    sourceLocale: "en",
    sourceHash,
    translatedAt: new Date().toISOString(),
    model,
    promptVersion,
    // The registry decides what we can honestly claim: a locale with no fluent
    // reviewer gets "automated", and the page says so.
    review: locale.reviewPolicy === "native" ? "native" : "automated",
  };
}

/** Has the source changed since we last translated it? */
async function isCurrent(target: string, expectedHash: string): Promise<boolean> {
  try {
    const existing = JSON.parse(await readFile(target, "utf8"));
    return existing?.translation?.sourceHash === expectedHash;
  } catch {
    return false;
  }
}

async function translateOutlook(locale: LocaleDef): Promise<"written" | "skipped"> {
  const sourcePath = path.join(CONTENT, "outlook", "current.json");
  const report: OutlookReport = outlookReportSchema.parse(
    JSON.parse(await readFile(sourcePath, "utf8")),
  );

  const fields = outlookFields(report);
  assertFieldMapCoverage(report, fields, "outlook/current.json");
  const sourceHash = hashFields(fields);

  const outDir = path.join(CONTENT, "outlook", locale.code);
  const outPath = path.join(outDir, "current.json");
  if (await isCurrent(outPath, sourceHash)) return "skipped";

  const provider = await getTranslationProvider();
  const { values, model, promptVersion } = await translateFields(provider, locale, fields);

  const translated: OutlookReport = outlookReportSchema.parse({
    ...applyTranslations(report, values),
    locale: locale.code,
    translation: meta(sourceHash, model, promptVersion, locale),
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(translated, null, 2) + "\n", "utf8");
  return "written";
}

async function translateArticles(locale: LocaleDef): Promise<{ written: number; skipped: number }> {
  const sourceDir = path.join(CONTENT, "articles");
  const outDir = path.join(sourceDir, locale.code);
  const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".json"));

  let written = 0;
  let skipped = 0;
  let provider: Awaited<ReturnType<typeof getTranslationProvider>> | null = null;

  for (const file of files) {
    const article: Article = articleSchema.parse(
      JSON.parse(await readFile(path.join(sourceDir, file), "utf8")),
    );
    // Drafts are not public, so translating them spends budget on content that
    // may never ship.
    if (article.status !== "published") continue;

    const fields = articleFields(article);
    assertFieldMapCoverage(article, fields, file);
    const sourceHash = hashFields(fields);

    const outPath = path.join(outDir, file);
    if (await isCurrent(outPath, sourceHash)) {
      skipped++;
      continue;
    }

    provider ??= await getTranslationProvider();
    const { values, model, promptVersion } = await translateFields(provider, locale, fields);

    const translated: Article = articleSchema.parse({
      ...applyTranslations(article, values),
      locale: locale.code,
      translation: meta(sourceHash, model, promptVersion, locale),
    });

    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, JSON.stringify(translated, null, 2) + "\n", "utf8");
    written++;
    console.log(`[i18n]   ${locale.code}/${file}`);
  }
  return { written, skipped };
}

/**
 * Translate the UI catalog, per key.
 *
 * Only missing or source-changed keys are sent; everything else — including
 * every hand-reviewed correction — is left exactly as it is. See
 * `server/i18n/catalog.ts` for why freshness is per key here rather than per
 * artifact.
 */
async function translateCatalog(locale: LocaleDef): Promise<string> {
  const english = readCatalog("en");
  if (!english) throw new Error("No English UI catalog.");

  const target = readCatalog(locale.code) ?? {};
  const meta = readMeta(locale.code);
  const plan = planCatalog(english, target, meta);

  if (plan.orphaned.length > 0) {
    console.warn(
      `[i18n] ${locale.code} catalog has ${plan.orphaned.length} key(s) not in English ` +
        `(likely a rename left behind): ${plan.orphaned.slice(0, 5).join(", ")}`,
    );
  }

  if (plan.stale.length === 0) {
    // Still rewrite the meta: a first run adopts existing translations, and
    // without recording their hashes they would be re-adopted forever rather
    // than being watched for source changes.
    writeMeta(locale.code, buildMeta(english, target));
    return `0 translated, ${plan.current.length} up to date`;
  }

  const byPath = new Map(catalogFields(english).map((f) => [f.path, f]));
  const fields = plan.stale.map((s) => byPath.get(s.path)!).filter(Boolean);

  const provider = await getTranslationProvider();
  const { values } = await provider.translate({ locale, fields });

  for (const [path, value] of Object.entries(values)) setPath(target, path, value);

  writeCatalog(locale.code, target);

  const next = buildMeta(english, target);
  for (const { path, value } of plan.stale) next[path] = hashValue(value);
  writeMeta(locale.code, next);

  return `${plan.stale.length} translated, ${plan.current.length} left untouched`;
}

async function main() {
  const only = process.env.TRANSLATE_ONLY;
  const requested = process.env.TRANSLATE_LOCALE;

  // TRANSLATION_TARGETS follows the *active* locale set, so backfilling a
  // not-yet-launched language needs an explicit locale — that is deliberate,
  // since translating a language nothing routes to should be a decision.
  const targets: LocaleDef[] = requested
    ? [requireLocale(requested)]
    : [...TRANSLATION_TARGETS];

  if (targets.length === 0) {
    console.log("[i18n] no translation targets — nothing to do.");
    return;
  }

  const provider = await getTranslationProvider();
  console.log(`[i18n] provider=${provider.name} targets=${targets.map((t) => t.code).join(",")}`);

  for (const locale of targets) {
    if (only === undefined || only === "catalog") {
      console.log(`[i18n] ${locale.code} catalog: ${await translateCatalog(locale)}`);
    }
    if (only === "catalog") continue;
    if (only !== "articles") {
      const r = await translateOutlook(locale);
      console.log(`[i18n] ${locale.code} outlook: ${r}`);
    }
    if (only !== "outlook") {
      const { written, skipped } = await translateArticles(locale);
      console.log(`[i18n] ${locale.code} articles: ${written} written, ${skipped} up to date`);
    }
  }
}

main().catch((err) => {
  console.error("[i18n] FAILED:", err);
  process.exit(1);
});
