import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

import { isActiveLocale, requireLocale } from "@/config/locales";
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
 *
 * Also covers next-intl rich-text tags (`<trends>…</trends>`, `<strong>…`).
 * A dropped tag pair is silent too — the link simply vanishes from the
 * translated page — and a renamed one throws at render time because no render
 * function exists for it. The translator may move a tag pair within the
 * sentence (word order requires it), so only the multiset is compared.
 */
function placeholders(text: string): string[] {
  return [...(text.match(/\{[a-zA-Z0-9_]+\}|%[sd]|<\/?[a-zA-Z][\w-]*>/g) ?? [])].sort();
}

/**
 * The ICU structure of a catalog message: its arguments, its plural/select
 * branches, and the literal text with all syntax removed.
 *
 * next-intl messages are ICU MessageFormat, so a catalog string can carry
 * syntax a regex cannot validate — `{count, plural, one {…} other {…}}`. A
 * translator that translates a keyword ("other" → "أخرى"), drops a branch's
 * argument, or unbalances a brace produces a message that throws at render
 * time on exactly the page and count that hits it. Parsing is the only honest
 * check.
 */
type IcuInfo =
  | { ok: true; args: Set<string>; branches: Map<string, { type: "plural" | "select"; keys: string[] }>; literal: string }
  | { ok: false; error: string };

function icuInfo(text: string): IcuInfo {
  let ast: MessageFormatElement[];
  try {
    ast = parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const args = new Set<string>();
  const branches = new Map<string, { type: "plural" | "select"; keys: string[] }>();
  const literal: string[] = [];
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.literal) literal.push(el.value);
      else if (el.type === TYPE.argument) args.add(`${el.value}:argument`);
      else if (el.type === TYPE.number) args.add(`${el.value}:number`);
      else if (el.type === TYPE.date || el.type === TYPE.time) args.add(`${el.value}:date`);
      else if (el.type === TYPE.tag) walk(el.children);
      else if (el.type === TYPE.plural || el.type === TYPE.select) {
        const type = el.type === TYPE.plural ? "plural" : "select";
        args.add(`${el.value}:${type}`);
        branches.set(el.value, { type, keys: Object.keys(el.options) });
        for (const option of Object.values(el.options)) walk(option.value);
      }
    }
  };
  walk(ast);
  return { ok: true, args, branches, literal: literal.join(" ") };
}

/**
 * Validate a translated message's ICU structure against its English source.
 * Plural branches may differ — that is the point of plurals (English has
 * one/other, Arabic zero/one/two/few/many/other) — but only CLDR categories
 * valid for the target locale, or exact `=N` matches, are allowed, and `other`
 * is mandatory. Select branches must match exactly: their keys are data.
 */
function icuFindings(source: IcuInfo, target: IcuInfo, locale: string, at: string): Finding[] {
  if (!source.ok) {
    return [{ severity: "error", path: at, message: `English source is not valid ICU: ${source.error}` }];
  }
  if (!target.ok) {
    return [{ severity: "error", path: at, message: `translation is not valid ICU (it would throw at render time): ${target.error}` }];
  }
  const findings: Finding[] = [];
  const s = [...source.args].sort().join(", ");
  const t = [...target.args].sort().join(", ");
  if (s !== t) {
    findings.push({ severity: "error", path: at, message: `ICU arguments changed: source has [${s || "none"}], translation has [${t || "none"}]` });
  }
  const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  for (const [name, { type, keys }] of target.branches) {
    const src = source.branches.get(name);
    if (!src) continue; // already reported as an argument change
    if (type === "select") {
      if ([...keys].sort().join() !== [...src.keys].sort().join()) {
        findings.push({ severity: "error", path: at, message: `select "${name}" branches changed: [${src.keys}] → [${keys}]` });
      }
      continue;
    }
    const invalid = keys.filter((k) => !categories.has(k as Intl.LDMLPluralRule) && !/^=\d+$/.test(k));
    if (invalid.length > 0) {
      findings.push({ severity: "error", path: at, message: `plural "${name}" uses categories that do not exist in ${locale}: [${invalid}] (valid: ${[...categories].join(", ")}, or =N)` });
    }
    if (!keys.includes("other")) {
      findings.push({ severity: "error", path: at, message: `plural "${name}" has no "other" branch` });
    }
  }
  return findings;
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
    /*
     * Severity depends on whether the locale is actually routed.
     *
     * A missing key in a locale nobody can reach cannot affect a visitor — it is
     * work-in-progress, and failing CI over it would mean English extraction and
     * its translation had to land in one commit, which is exactly the coupling
     * the per-key model exists to avoid. The moment the locale is enabled in the
     * registry it becomes an error, which is precisely when a silent fallback to
     * English would start reaching readers.
     */
    findings.push({
      severity: isActiveLocale(locale) ? "error" : "warning",
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

  /*
   * Per-string content checks — the same rules the artifacts get.
   *
   * These used to apply only to artifacts, on the assumption that a catalog
   * holds short UI labels. That stopped being true when the tool-page copy moved
   * in: the catalog now carries FAQ answers stating that a troy ounce is
   * 31.1035 grams and a 1 kg bar is 32.15 ozt. A corrupted constant there is the
   * same financial error it would be in an article, and it was passing clean.
   */
  const englishByPath = new Map(catalogFields(canonical).map((f) => [f.path, f.value]));
  for (const field of catalogFields(target)) {
    const source = englishByPath.get(field.path);
    if (source === undefined) continue;
    const at = `ui/${locale}.json → ${field.path}`;

    /* ICU structure first — a message that does not parse makes every other
     * check below meaningless. */
    const sIcu = icuInfo(source);
    const tIcu = icuInfo(field.value);
    findings.push(...icuFindings(sIcu, tIcu, locale, at));
    // A plural repeats its text once per branch, and the two languages have
    // different numbers of branches. Compare numbers and tokens as SETS there,
    // and only over literal text, so an `=1` selector is not read as a digit.
    const branched = sIcu.ok && tIcu.ok && (sIcu.branches.size > 0 || tIcu.branches.size > 0);
    const numText = (raw: string, info: IcuInfo) => (branched && info.ok ? info.literal : raw);

    /*
     * Numeral parity, split by *precision* rather than by strict equality.
     *
     * A number that changed or was invented is always an error — that is the
     * 99.9999-grams case, and there is no benign reading of it.
     *
     * A number present in English and absent from the translation is judged on
     * what kind of number it is, because prose genuinely spells small round
     * numbers as words: "a 30-day chart" → "رسم بياني لثلاثين يومًا", "a 1 kg
     * bar" → "سبيكة الكيلوغرام الواحد". Both are correct translations, and both
     * appear in this catalog today. But a value carrying a decimal — 31.1035
     * grams, 32.15 ozt, 4,283.61 — is a precise constant nobody spells out, so
     * its disappearance is an omission. Three or more digits counts as precise
     * for the same reason.
     */
    const tokens = (text: string) =>
      (text.match(/\d[\d.,٫٬]*/g) ?? []).map((raw) => ({
        raw,
        norm: raw.replace(/[.,٫٬]/g, ""),
        // A decimal separator, or enough digits that it is not a spoken round
        // number, means the exact value carries meaning.
        precise: /[.,٫٬]\d/.test(raw) || raw.replace(/[.,٫٬]/g, "").length >= 3,
      }));

    const uniq = <T extends { norm: string }>(list: T[]) =>
      branched ? list.filter((x, i) => list.findIndex((y) => y.norm === x.norm) === i) : list;
    const remaining = uniq(tokens(numText(field.value, tIcu)));
    const dropped: { raw: string; precise: boolean }[] = [];
    for (const t of uniq(tokens(numText(source, sIcu)))) {
      const i = remaining.findIndex((r) => r.norm === t.norm);
      if (i === -1) dropped.push(t);
      else remaining.splice(i, 1);
    }

    if (remaining.length > 0) {
      findings.push({
        severity: "error",
        path: at,
        message: `numbers not in the English source: [${remaining.map((r) => r.raw).join(", ")}]`,
      });
    }
    const lostPrecise = dropped.filter((d) => d.precise);
    const lostRound = dropped.filter((d) => !d.precise);
    if (lostPrecise.length > 0) {
      findings.push({
        severity: "error",
        path: at,
        message: `precise value(s) dropped from the translation: [${lostPrecise.map((d) => d.raw).join(", ")}]`,
      });
    }
    if (lostRound.length > 0) {
      findings.push({
        severity: "warning",
        path: at,
        message: `[${lostRound.map((d) => d.raw).join(", ")}] not written as digits — fine if spelled as a word, check it is not an omission`,
      });
    }

    if (ARABIC_INDIC.test(field.value)) {
      findings.push({
        severity: "error",
        path: at,
        message: "contains Arabic-Indic digits; the site renders Latin digits everywhere",
      });
    }

    const sp = placeholders(source);
    const tp = placeholders(field.value);
    const sig = (list: string[]) => (branched ? [...new Set(list)] : list).join("|");
    if (sig(sp) !== sig(tp)) {
      findings.push({
        severity: "error",
        path: at,
        message: `placeholders changed: source has [${sp.join(", ") || "none"}], translation has [${tp.join(", ") || "none"}]`,
      });
    }
  }

  /*
   * Glossary compliance, corpus-wide and aggregated — the same shape as the
   * artifact rule, for the same reasons. Corpus-wide because a term may move
   * between strings; aggregated because reported per term an untranslated
   * catalog buries every other finding under sixty warnings.
   */
  const glossary = loadGlossary(locale);
  if (glossary) {
    const sourceCorpus = catalogFields(canonical)
      .map((f) => f.value)
      .join("\n")
      .toLowerCase();
    const targetCorpus = catalogFields(target)
      .map((f) => f.value)
      .join("\n");
    const missed: string[] = [];
    let applicable = 0;
    for (const entry of glossaryEntries(glossary)) {
      if (!sourceCorpus.includes(entry.en.toLowerCase())) continue;
      applicable++;
      if (!entry.accepted.some((form) => targetCorpus.includes(form))) {
        missed.push(`${entry.en} → ${entry.accepted.join(" / ")}`);
      }
    }
    if (missed.length > 0) {
      const shown = missed.slice(0, 5);
      const rest = missed.length - shown.length;
      findings.push({
        severity: "warning",
        path: `ui/${locale}.json → <glossary>`,
        message:
          `${missed.length}/${applicable} glossary terms have no approved rendering anywhere in the catalog: ` +
          shown.join("; ") +
          (rest > 0 ? `; …and ${rest} more` : ""),
      });
    }
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
