import { requireLocale } from "@/config/locales";
import {
  assertFieldMapCoverage,
  catalogFields,
  hashFields,
  hashValue,
  type TranslatableField,
} from "@/server/i18n/field-map";
import { glossaryEntries, loadGlossary } from "@/server/i18n/glossary";

/**
 * Mechanical checks on a translated artifact.
 *
 * The point of this module: correctness must not depend on the reviewer reading
 * the language. For Arabic the owner reads it and this is a safety net; for a
 * locale nobody here reads, this plus the back-translation review IS the gate.
 * So every rule here is one that can be verified without comprehension —
 * digits, URLs, structure, terminology presence, length.
 *
 * What it deliberately cannot check is meaning. That is what
 * `reviewPolicy: "native"` and the back-translation pass are for; nothing below
 * should be read as evidence that a translation *says the right thing*.
 */

export type Finding = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

const ARABIC_INDIC = /[٠-٩۰-۹]/u;

/**
 * Every number in a string, normalised for comparison.
 *
 * Separators are stripped rather than compared, because locales legitimately
 * differ on them; the *digits* are what must not move. Returned sorted so field
 * order inside a sentence can change (which translation constantly requires)
 * without tripping the check.
 */
function numerals(text: string): string[] {
  return (text.match(/\d[\d.,٫٬]*/g) ?? [])
    .map((n) => n.replace(/[.,٫٬]/g, ""))
    .filter(Boolean)
    .sort();
}

/**
 * Interpolation tokens that must survive translation intact.
 *
 * Covers ICU-style `{name}` (next-intl) and `%s` (Next.js's metadata title
 * template). Dropping one is silent and total: a translated `titleTemplate`
 * without its `%s` gives every page on the site the same title, and a lost
 * `{name}` renders the literal word rather than the brand.
 */
function placeholders(text: string): string[] {
  return [...(text.match(/\{[a-zA-Z0-9_]+\}|%[sd]/g) ?? [])].sort();
}

function urls(text: string): string[] {
  return (text.match(/https?:\/\/[^\s)"'<>]+/g) ?? []).sort();
}

function markdownShape(text: string) {
  const lines = text.split("\n");
  return {
    headings: lines
      .filter((l) => /^#{1,6}\s/.test(l))
      .map((l) => (l.match(/^#+/) ?? [""])[0].length),
    listItems: lines.filter((l) => /^\s*([-*+]|\d+\.)\s/.test(l)).length,
    tableRows: lines.filter((l) => /^\s*\|.*\|\s*$/.test(l)).length,
    links: (text.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length,
    fences: (text.match(/```/g) ?? []).length,
  };
}

/**
 * Every primitive leaf in an object, keyed by dotted path.
 *
 * Includes numbers, booleans and nulls — not just strings — because the fields
 * that must never move (a spot price, a macro reading, a signal enum) are mostly
 * not strings.
 */
function leafPaths(value: unknown, prefix = "", out = new Map<string, unknown>()): Map<string, unknown> {
  if (value === null || typeof value !== "object") {
    if (prefix) out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => leafPaths(v, prefix ? `${prefix}.${i}` : `${i}`, out));
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    leafPaths(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** Latin-script character ratio, ignoring anything legitimately Latin. */
function latinRatio(text: string, exempt: string[]): number {
  let stripped = text
    .replace(/https?:\/\/[^\s)"'<>]+/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[\d.,%$+\-–—()[\]{}:;/\\|'"«»…\s]/g, "");
  for (const term of exempt) {
    stripped = stripped.split(term).join("");
  }
  const letters = stripped.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return 0;
  const latin = letters.match(/[A-Za-z]/g)?.length ?? 0;
  return latin / letters.length;
}

/* -------------------------------------------------------------------------- */
/* UI catalog parity                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The UI message catalogs are hand-authored, not pipeline-translated, so they
 * have no `sourceHash` to go stale. Their failure mode is different and just as
 * quiet: someone adds an English key and the other locales silently fall back to
 * English on a page that is otherwise fully translated.
 *
 * next-intl's `onError` logs a missing message in production but does not fail a
 * build, so without this a half-translated catalog ships. Extra keys matter too —
 * they are usually a rename that left the old key behind, which then rots.
 */
export function checkCatalogParity(
  canonical: Record<string, unknown>,
  target: Record<string, unknown>,
  locale: string,
  /** `<locale>.meta.json` — per-key hashes of the English each translation was made from. */
  meta: Record<string, string> = {},
): Finding[] {
  const paths = (o: unknown, prefix = ""): string[] => {
    if (o === null || typeof o !== "object") return prefix ? [prefix] : [];
    return Object.entries(o).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k),
    );
  };

  const en = new Set(paths(canonical));
  const tr = new Set(paths(target));
  const findings: Finding[] = [];

  const missing = [...en].filter((k) => !tr.has(k));
  const extra = [...tr].filter((k) => !en.has(k));

  if (missing.length > 0) {
    findings.push({
      severity: "error",
      path: `ui/${locale}.json`,
      message: `${missing.length} key(s) missing, so these fall back to English: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", …" : ""}`,
    });
  }
  if (extra.length > 0) {
    findings.push({
      severity: "warning",
      path: `ui/${locale}.json`,
      message: `${extra.length} key(s) not present in the English catalog (likely a rename left behind): ${extra.slice(0, 8).join(", ")}${extra.length > 8 ? ", …" : ""}`,
    });
  }

  /*
   * Stale keys: the English changed after this translation was made.
   *
   * Distinct from a *missing* key, and quieter — the page still renders
   * translated text, it is just translated from an older English string. Only
   * the per-key meta can tell the difference, which is why it exists.
   */
  const stale = catalogFields(canonical)
    .filter((f) => {
      const recorded = meta[f.path];
      // No record means "adopted at bootstrap", not stale — see catalog.ts.
      return recorded !== undefined && recorded !== hashValue(f.value);
    })
    .map((f) => f.path);

  if (stale.length > 0) {
    findings.push({
      severity: "error",
      path: `ui/${locale}.json`,
      message: `${stale.length} key(s) translated from an older English source; re-run i18n:translate: ${stale.slice(0, 8).join(", ")}${stale.length > 8 ? ", …" : ""}`,
    });
  }

  return findings;
}

/* -------------------------------------------------------------------------- */
/* The check                                                                   */
/* -------------------------------------------------------------------------- */

export type CheckInput = {
  label: string;
  locale: string;
  sourceFields: TranslatableField[];
  translatedFields: TranslatableField[];
  /** Full artifacts, for the non-translatable deep comparison. */
  source: Record<string, unknown>;
  translated: Record<string, unknown>;
  /** `translation.sourceHash` as stored on the artifact. */
  storedHash?: string;
};

export function checkTranslation(input: CheckInput): Finding[] {
  const findings: Finding[] = [];
  const locale = requireLocale(input.locale);
  const err = (path: string, message: string) =>
    findings.push({ severity: "error", path, message });
  const warn = (path: string, message: string) =>
    findings.push({ severity: "warning", path, message });

  const sourceByPath = new Map(input.sourceFields.map((f) => [f.path, f]));
  const targetByPath = new Map(input.translatedFields.map((f) => [f.path, f]));

  /* 1. Field-map coverage — a new contract field must not silently go untranslated. */
  try {
    assertFieldMapCoverage(input.translated, input.translatedFields, input.label);
  } catch (e) {
    err("<artifact>", (e as Error).message);
  }

  /* 2. Key parity. */
  for (const path of sourceByPath.keys()) {
    if (!targetByPath.has(path)) err(path, "missing from the translated artifact");
  }
  for (const path of targetByPath.keys()) {
    if (!sourceByPath.has(path)) err(path, "present in the translation but not the source");
  }

  /* 3. Every leaf that is NOT translated must be byte-identical to the source.
   *
   *    Compared leaf by leaf rather than by top-level key. Comparing whole keys
   *    lets a non-translatable field hide behind a translatable sibling: because
   *    `calls.0.label` is translated, a key-level comparison skips all of
   *    `calls` and a flipped `calls.0.signal` — BUY becoming SELL — passes
   *    unnoticed. That is the single worst thing this checker could miss, and an
   *    earlier version of it did. */
  const sourceLeaves = leafPaths(input.source);
  const translatedLeaves = leafPaths(input.translated);
  const ignored = (path: string) =>
    path === "locale" || path.startsWith("translation.") || targetByPath.has(path);

  for (const [path, value] of sourceLeaves) {
    if (ignored(path)) continue;
    if (!translatedLeaves.has(path)) {
      err(path, "non-translatable field is missing from the translation");
    } else if (JSON.stringify(translatedLeaves.get(path)) !== JSON.stringify(value)) {
      err(
        path,
        `non-translatable field differs from the source (${JSON.stringify(value)} → ${JSON.stringify(translatedLeaves.get(path))})`,
      );
    }
  }
  for (const path of translatedLeaves.keys()) {
    if (ignored(path) || sourceLeaves.has(path)) continue;
    err(path, "field exists in the translation but not in the source");
  }

  /* 4–8. Per-field content checks. */
  const glossary = loadGlossary(input.locale);
  const entries = glossary ? glossaryEntries(glossary) : [];
  const exempt = glossary?.doNotTranslate ?? [];

  for (const [path, target] of targetByPath) {
    const source = sourceByPath.get(path);
    if (!source) continue;

    /* 4. Numeral parity — the single most important rule on a financial site. */
    const a = numerals(source.value);
    const b = numerals(target.value);
    if (a.join("|") !== b.join("|")) {
      err(
        path,
        `numbers changed: source has [${a.join(", ")}], translation has [${b.join(", ")}]`,
      );
    }
    if (ARABIC_INDIC.test(target.value)) {
      err(path, "contains Arabic-Indic digits; the site renders Latin digits everywhere");
    }

    /* 5. Interpolation tokens must survive exactly. */
    const sp = placeholders(source.value);
    const tp = placeholders(target.value);
    if (sp.join("|") !== tp.join("|")) {
      err(
        path,
        `placeholders changed: source has [${sp.join(", ") || "none"}], translation has [${tp.join(", ") || "none"}]`,
      );
    }

    /* 6. URLs must be identical and equally numerous. */
    const su = urls(source.value);
    const tu = urls(target.value);
    if (su.join("|") !== tu.join("|")) {
      err(path, `URLs changed: source ${su.length}, translation ${tu.length}`);
    }

    /* 7. Markdown structure parity. */
    if (source.kind === "markdown") {
      const s = markdownShape(source.value);
      const t = markdownShape(target.value);
      if (s.headings.join(",") !== t.headings.join(","))
        err(path, `heading structure changed: [${s.headings}] vs [${t.headings}]`);
      if (s.listItems !== t.listItems)
        err(path, `list items changed: ${s.listItems} vs ${t.listItems}`);
      if (s.tableRows !== t.tableRows)
        err(path, `table rows changed: ${s.tableRows} vs ${t.tableRows}`);
      if (s.links !== t.links)
        err(path, `markdown links changed: ${s.links} vs ${t.links}`);
      if (t.fences > s.fences)
        err(path, "introduced a code fence that is not in the source");
    }

    /* 8. Money fields are reformatted, never re-valued. Digits are already
     *    covered above; this asserts the locale's currency unit is present. */
    if (source.kind === "money" && /[$£€]|USD/.test(source.value)) {
      if (!target.value.includes(locale.currency.unit)) {
        err(
          path,
          `money value is missing the locale's currency unit "${locale.currency.unit}"`,
        );
      }
    }

    /* 9. Do-not-translate terms must survive verbatim. */
    for (const term of exempt) {
      if (source.value.includes(term) && !target.value.includes(term)) {
        err(path, `do-not-translate term "${term}" is missing from the translation`);
      }
    }
  }

  /* 10. Glossary compliance, across the whole artifact rather than per field —
   *    a term may legitimately move between sentences during translation. */
  const sourceCorpus = input.sourceFields.map((f) => f.value).join("\n").toLowerCase();
  const targetCorpus = input.translatedFields.map((f) => f.value).join("\n");
  const missedTerms: string[] = [];
  let applicableTerms = 0;
  for (const entry of entries) {
    if (!sourceCorpus.includes(entry.en.toLowerCase())) continue;
    applicableTerms++;
    if (!entry.accepted.some((form) => targetCorpus.includes(form))) {
      missedTerms.push(`${entry.en} → ${entry.accepted.join(" / ")}`);
    }
  }
  if (missedTerms.length > 0) {
    // Aggregated into one finding on purpose. Reported per term, a wholly
    // untranslated artifact emits sixty warnings and buries everything else in
    // the run; the count is the signal, and a handful of examples is enough to
    // start looking.
    const shown = missedTerms.slice(0, 5);
    const rest = missedTerms.length - shown.length;
    warn(
      "<glossary>",
      `${missedTerms.length}/${applicableTerms} glossary terms have no approved rendering in the translation: ` +
        shown.join("; ") +
        (rest > 0 ? `; …and ${rest} more` : ""),
    );
  }

  /* 11. Length ratio — catches truncation and omission without comprehension. */
  const sourceLen = input.sourceFields.reduce((n, f) => n + f.value.length, 0);
  const targetLen = input.translatedFields.reduce((n, f) => n + f.value.length, 0);
  const ratio = sourceLen > 0 ? targetLen / sourceLen : 1;
  const [lo, hi] = locale.lengthRatio;
  if (ratio < lo || ratio > hi) {
    err(
      "<artifact>",
      `length ratio ${ratio.toFixed(2)} is outside the expected ${lo}–${hi} for ${locale.englishLabel}; likely truncated or padded`,
    );
  }

  /* 12. Untranslated residue. A warning, not an error: quoted English, tickers
   *     and institution names legitimately appear in Arabic financial prose. */
  if (locale.dir === "rtl") {
    // Aggregated like the glossary check: an untranslated artifact would
    // otherwise emit one warning per field and hide the errors above it.
    const untranslated = [...targetByPath.values()]
      .filter((f) => f.kind !== "money" && latinRatio(f.value, exempt) > 0.4)
      .map((f) => f.path);
    if (untranslated.length > 0) {
      const shown = untranslated.slice(0, 4);
      const rest = untranslated.length - shown.length;
      warn(
        "<residue>",
        `${untranslated.length}/${targetByPath.size} fields are mostly Latin script and may not have been translated: ` +
          shown.join(", ") +
          (rest > 0 ? `, …and ${rest} more` : ""),
      );
    }
  }

  /* 13. Freshness. Proves the translation matches the current source rather
   *     than an older revision of it. */
  if (input.storedHash !== undefined) {
    const expected = hashFields(input.sourceFields);
    if (input.storedHash !== expected) {
      err(
        "<artifact>",
        `stale: translation.sourceHash is ${input.storedHash} but the source now hashes to ${expected}. Re-run i18n:translate.`,
      );
    }
  }

  return findings;
}
