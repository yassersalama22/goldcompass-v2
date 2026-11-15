import { createHash } from "node:crypto";

import type { Article } from "@/types/article";
import type { OutlookReport } from "@/types/outlook";
import type { PageDoc } from "@/types/page";

/**
 * Which fields of a content artifact get translated — and, just as importantly,
 * which never do.
 *
 * This is the safety spine of the translation pipeline. Nothing hands a whole
 * artifact to a model and hopes: a translator receives a flat
 * `{ path: string }` map built from the allowlist below, must return the same
 * key set, and the values are written back into a copy of the source. Structure
 * therefore cannot drift, numbers outside the allowlist cannot be rewritten, and
 * `i18n:check` can compare the two artifacts field by field.
 *
 * The division mirrors §4's separation of retrieval from reasoning:
 * **prose is translated, data is copied.**
 *
 * Adding a field to either contract without adding it here means it silently
 * stays English in every translation. `assertFieldMapCoverage()` below turns
 * that into a loud failure instead.
 */

/** A leaf we translate: where it lives, and what it is, so the prompt can say so. */
export type TranslatableField = {
  /** Dotted path with array indices, e.g. `calls.0.reason`. */
  path: string;
  value: string;
  /**
   * What kind of text this is. The prompt treats these differently — a heading
   * has no sentence punctuation, Markdown must survive intact, and a UI label
   * has a length budget the layout depends on.
   */
  kind: "title" | "summary" | "markdown" | "label" | "phrase" | "money";
};

/* -------------------------------------------------------------------------- */
/* Articles                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `sources[].title` is deliberately absent.
 *
 * Those cite English-language publications and sit next to a link to the page
 * they name. A translated citation title cannot be checked against the document
 * it points at, which is precisely the verifiability a citation exists to
 * provide. `i18n:check` asserts they are byte-identical to the source.
 */
export function articleFields(article: Article): TranslatableField[] {
  return [
    { path: "title", value: article.title, kind: "title" },
    { path: "description", value: article.description, kind: "summary" },
    { path: "category", value: article.category, kind: "label" },
    ...article.tags.map((tag, i) => ({
      path: `tags.${i}`,
      value: tag,
      kind: "label" as const,
    })),
    { path: "bodyMarkdown", value: article.bodyMarkdown, kind: "markdown" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Outlook                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Excluded from the outlook, and why each one matters:
 *
 *  - `calls[].signal` / `.confidence` / `.term` — enums. The UI localizes the
 *    *label*; translating the enum would break `signalSchema` and every
 *    consumer of `/api/v1/recommendations`.
 *  - `spot.*`, and every number in `macro` — deterministic data the pipeline
 *    fetched. A model must never be in a position to alter a price.
 *  - `macro.source` — the attribution string the data provider's terms require,
 *    and `macro-panel.tsx` plus the Markdown builder both rely on it beginning
 *    with "Source:".
 *  - `sources[]` — see the note on articles.
 *  - Everything that records HOW a call was set — `since`, `previous`,
 *    `change`, `levels`, `baseline`, the whole `scorecard` and `context` — is
 *    computed by the pipeline. A translation that could alter "SELL since
 *    2026-11-15" or a frozen level would be altering the call itself.
 *    Scorecard factors carry keys, not labels: the UI catalog words them.
 *
 * `keyLevels[].value` IS included, as `kind: "money"`. It is a formatted string
 * in the artifact (`"$4,283.61"`, `"$4,000–$4,070"`), so leaving it out would
 * put `$4,283.61` in the key-levels grid directly under a header reading
 * `4,283.61 دولار`. It is reformatted, never re-valued: the numeral-parity check
 * in `i18n:check` fails if any digit changes, which is what makes this safe.
 */
export function outlookFields(report: OutlookReport): TranslatableField[] {
  const fields: TranslatableField[] = [
    { path: "summary", value: report.summary, kind: "summary" },
    { path: "analysisMarkdown", value: report.analysisMarkdown, kind: "markdown" },
  ];

  report.calls.forEach((call, i) => {
    fields.push(
      { path: `calls.${i}.label`, value: call.label, kind: "label" },
      { path: `calls.${i}.horizon`, value: call.horizon, kind: "label" },
      { path: `calls.${i}.reason`, value: call.reason, kind: "phrase" },
    );
    if (call.invalidation !== undefined) {
      fields.push({
        path: `calls.${i}.invalidation`,
        value: call.invalidation,
        kind: "phrase",
      });
    }
    if (call.adjustment !== undefined) {
      fields.push({
        path: `calls.${i}.adjustment.reason`,
        value: call.adjustment.reason,
        kind: "phrase",
      });
    }
  });

  // The events behind the analysis. Title and summary are prose; the date,
  // direction, horizon and URL are data, and stay exactly as published.
  report.drivers?.forEach((driver, i) => {
    fields.push(
      { path: `drivers.${i}.title`, value: driver.title, kind: "title" },
      { path: `drivers.${i}.summary`, value: driver.summary, kind: "phrase" },
    );
  });

  report.keyLevels.forEach((level, i) => {
    fields.push(
      { path: `keyLevels.${i}.label`, value: level.label, kind: "label" },
      { path: `keyLevels.${i}.value`, value: level.value, kind: "money" },
    );
  });

  report.macro?.indicators.forEach((indicator, i) => {
    fields.push({
      path: `macro.indicators.${i}.label`,
      value: indicator.label,
      kind: "label",
    });
  });

  return fields;
}

/* -------------------------------------------------------------------------- */
/* Static prose pages                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `slug` is excluded: it is the route segment, and translated pages reuse it so
 * that `/disclaimer` and `/ar/disclaimer` pair 1:1 in hreflang — the same
 * decision as article slugs.
 */
export function pageFields(page: PageDoc): TranslatableField[] {
  return [
    { path: "title", value: page.title, kind: "title" },
    { path: "description", value: page.description, kind: "summary" },
    ...(page.eyebrow
      ? [{ path: "eyebrow", value: page.eyebrow, kind: "label" as const }]
      : []),
    { path: "heading", value: page.heading, kind: "title" as const },
    ...(page.lede
      ? [{ path: "lede", value: page.lede, kind: "summary" as const }]
      : []),
    { path: "bodyMarkdown", value: page.bodyMarkdown, kind: "markdown" },
  ];
}

/* -------------------------------------------------------------------------- */
/* UI message catalog                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Kind of a catalog string, inferred from its key and length.
 *
 * A heuristic rather than a declaration, deliberately: declaring a kind per key
 * would be 71 lines of config today and one more every time a string is added,
 * and the cost of getting one wrong is a slightly off translation register, not
 * a correctness bug. The distinctions that actually matter — numbers, URLs,
 * placeholders, structure — are enforced by `i18n:check` regardless of kind.
 */
function catalogKind(path: string, value: string): TranslatableField["kind"] {
  const key = path.split(".").pop() ?? "";
  if (/^(heading|title|metaTitle|ogTitle|defaultTitle)$/i.test(key)) return "title";
  if (/^(lede|description|metaDescription|ogDescription|shortDescription)$/i.test(key))
    return "summary";
  if (/^(body|a\d+|answer)$/i.test(key) || value.length > 160) return "phrase";
  return "label";
}

/**
 * Flatten a UI catalog to translatable fields.
 *
 * The catalog is translated by the pipeline like any other content, which is the
 * point: page copy that lives here would otherwise be hand-translated and so
 * bypass the glossary and every rule in `i18n:check`. That is fine for a dozen
 * nav labels and untenable for the long financial prose the tool and
 * methodology pages carry.
 */
export function catalogFields(
  catalog: Record<string, unknown>,
  prefix = "",
): TranslatableField[] {
  const fields: TranslatableField[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      fields.push({ path, value, kind: catalogKind(path, value) });
    } else if (value && typeof value === "object") {
      fields.push(...catalogFields(value as Record<string, unknown>, path));
    }
  }
  return fields;
}

/** Hash one string — the unit of freshness for a per-key-translated catalog. */
export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/* -------------------------------------------------------------------------- */
/* Apply + hash                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Write translated values back onto a deep copy of the source.
 *
 * Starting from a copy of the source rather than from the model's output is the
 * point: every field the map does not name keeps the source's exact value, so
 * an omission degrades to "still English" rather than to "missing", and a model
 * cannot introduce a field at all.
 */
export function applyTranslations<T extends object>(
  source: T,
  translations: Record<string, string>,
): T {
  const out = structuredClone(source) as Record<string, unknown>;

  for (const [path, value] of Object.entries(translations)) {
    const segments = path.split(".");
    let cursor: Record<string, unknown> = out;
    for (const segment of segments.slice(0, -1)) {
      const next = cursor[segment];
      if (next === null || typeof next !== "object") {
        throw new Error(`Translation path does not exist on source: ${path}`);
      }
      cursor = next as Record<string, unknown>;
    }
    const leaf = segments[segments.length - 1]!;
    if (!(leaf in cursor)) {
      throw new Error(`Translation path does not exist on source: ${path}`);
    }
    cursor[leaf] = value;
  }

  return out as T;
}

/**
 * Hash of the translatable content only — the freshness key stored on a
 * translated artifact as `translation.sourceHash`.
 *
 * Paths are included alongside values so that moving text between fields (two
 * key levels swapping labels, say) changes the hash even though the multiset of
 * strings did not.
 */
export function hashFields(fields: TranslatableField[]): string {
  const canonical = fields
    .map((f) => `${f.path} ${f.value}`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** Flat `{ path: value }` map — the shape handed to a translator. */
export function toRecord(fields: TranslatableField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.path, f.value]));
}

/* -------------------------------------------------------------------------- */
/* Coverage                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every string path in an artifact that is deliberately NOT translated.
 *
 * Written out rather than defaulted, because "not in the allowlist" and
 * "decided not to translate" look identical at runtime and mean very different
 * things. A new contract field matches neither list and trips the assertion
 * below, which is the entire point: the decision gets made by a person, once,
 * instead of defaulting to "silently stays English".
 */
const NEVER_TRANSLATED: RegExp[] = [
  /^slug$/,
  /^contractVersion$/,
  /^kind$/,
  /^date$/,
  /^updatedAt$/,
  /^origin$/,
  /^status$/,
  /^locale$/,
  /^translation\./,
  /^sources\.\d+\.(title|url)$/,
  // Outlook-specific
  /^calls\.\d+\.(term|signal|confidence)$/,
  /^spot\./,
  /^macro\.source$/,
  /^macro\.fetchedAt$/,
  /^macro\.indicators\.\d+\.(key|unit|asOf|goldEffect)$/,
  // How the call was set (Aureus v3) — computed, never prose.
  /^calls\.\d+\.(since|baseline)$/,
  /^calls\.\d+\.previous\.(signal|until)$/,
  /^calls\.\d+\.change\.(reason|date)$/,
  /^calls\.\d+\.levels\.(setOn|basis)$/,
  /^scorecard\.rulesVersion$/,
  /^scorecard\.(short|long)\.factors\.\d+\.(key|unit)$/,
  /^context\.asOf$/,
  /^context\.high52w\.date$/,
  /^drivers\.\d+\.(direction|horizon|eventDate|url)$/,
];

/** Collect every string leaf in an object, as dotted paths. */
function stringPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => stringPaths(v, prefix ? `${prefix}.${i}` : `${i}`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      stringPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

/**
 * Fail loudly if the artifact contains translatable-looking text that is neither
 * in the field map nor on the never-translate list.
 *
 * Called by `i18n:check`, so it runs in CI on every content PR rather than only
 * when someone remembers.
 */
export function assertFieldMapCoverage(
  artifact: object,
  fields: TranslatableField[],
  label: string,
): void {
  const translated = new Set(fields.map((f) => f.path));
  const unaccounted = stringPaths(artifact).filter(
    (path) =>
      !translated.has(path) && !NEVER_TRANSLATED.some((re) => re.test(path)),
  );

  if (unaccounted.length > 0) {
    throw new Error(
      `${label}: these string fields are neither translated nor explicitly ` +
        `excluded — add them to the field map or to NEVER_TRANSLATED in ` +
        `src/server/i18n/field-map.ts:\n  ${unaccounted.join("\n  ")}`,
    );
  }
}
