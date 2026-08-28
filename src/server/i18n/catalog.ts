import fs from "node:fs";
import path from "node:path";

import { catalogFields, hashValue } from "@/server/i18n/field-map";

/**
 * Per-key freshness for the UI message catalogs.
 *
 * The catalogs are *part hand-authored*: a native speaker has reviewed and
 * corrected strings in them. So the artifact-level `sourceHash` used for
 * articles and the outlook is the wrong model here — it would either re-translate
 * the whole file on any change (discarding those corrections) or mark the whole
 * file stale forever.
 *
 * Instead a sibling `<locale>.meta.json` records, per key, the hash of the
 * English string that the current translation was made from:
 *
 *   { "nav.outlook": "9f2c…", "about.lede": "41ab…" }
 *
 * A key is retranslated only when it is missing from the target, or when its
 * English source has changed since. A hand-edit leaves the hash untouched and so
 * survives every subsequent run — which is the whole point.
 */

const CATALOG_DIR = path.join(process.cwd(), "src", "content", "i18n", "ui");

export type CatalogMeta = Record<string, string>;

export function catalogPath(locale: string): string {
  return path.join(CATALOG_DIR, `${locale}.json`);
}

export function metaPath(locale: string): string {
  return path.join(CATALOG_DIR, `${locale}.meta.json`);
}

export function readCatalog(locale: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(catalogPath(locale), "utf8"));
  } catch {
    return null;
  }
}

export function readMeta(locale: string): CatalogMeta {
  try {
    return JSON.parse(fs.readFileSync(metaPath(locale), "utf8"));
  } catch {
    return {};
  }
}

/** Read a dotted path out of a nested catalog. */
export function getPath(obj: Record<string, unknown>, dotted: string): string | undefined {
  let cursor: unknown = obj;
  for (const segment of dotted.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

/** Write a dotted path into a nested catalog, creating objects as needed. */
export function setPath(
  obj: Record<string, unknown>,
  dotted: string,
  value: string,
): void {
  const segments = dotted.split(".");
  let cursor = obj;
  for (const segment of segments.slice(0, -1)) {
    if (typeof cursor[segment] !== "object" || cursor[segment] === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = value;
}

export type CatalogPlan = {
  /** Keys needing translation: absent from the target, or their source changed. */
  stale: { path: string; value: string }[];
  /** Keys whose existing translation is current — left untouched. */
  current: string[];
  /** Keys in the target that no longer exist in English. */
  orphaned: string[];
};

/**
 * Work out what actually needs translating for `locale`.
 *
 * **Bootstrap behaviour matters here.** On the first run there is no meta file,
 * and treating "no record" as "needs translation" would discard every
 * hand-written translation already in the catalog. So an existing target string
 * with no recorded hash is *adopted*: assumed to be a correct translation of the
 * current English, and recorded as such. Only genuinely missing keys are
 * translated. Anything already reviewed stays reviewed.
 */
export function planCatalog(
  english: Record<string, unknown>,
  target: Record<string, unknown>,
  meta: CatalogMeta,
): CatalogPlan {
  const fields = catalogFields(english);
  const plan: CatalogPlan = { stale: [], current: [], orphaned: [] };

  for (const field of fields) {
    const existing = getPath(target, field.path);
    const recorded = meta[field.path];
    const currentHash = hashValue(field.value);

    if (existing === undefined) {
      plan.stale.push({ path: field.path, value: field.value });
    } else if (recorded === undefined || recorded === currentHash) {
      // No record = adopt (bootstrap). Matching record = still current.
      plan.current.push(field.path);
    } else {
      plan.stale.push({ path: field.path, value: field.value });
    }
  }

  const englishPaths = new Set(fields.map((f) => f.path));
  for (const field of catalogFields(target)) {
    if (!englishPaths.has(field.path)) plan.orphaned.push(field.path);
  }

  return plan;
}

/** Meta reflecting the current English for every key present in `target`. */
export function buildMeta(
  english: Record<string, unknown>,
  target: Record<string, unknown>,
): CatalogMeta {
  const meta: CatalogMeta = {};
  for (const field of catalogFields(english)) {
    if (getPath(target, field.path) !== undefined) {
      meta[field.path] = hashValue(field.value);
    }
  }
  return meta;
}

export function writeCatalog(locale: string, catalog: Record<string, unknown>): void {
  fs.writeFileSync(
    catalogPath(locale),
    JSON.stringify(catalog, null, 2) + "\n",
    "utf8",
  );
}

export function writeMeta(locale: string, meta: CatalogMeta): void {
  // Sorted so the file diffs cleanly when one key changes.
  const sorted = Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(metaPath(locale), JSON.stringify(sorted, null, 2) + "\n", "utf8");
}
