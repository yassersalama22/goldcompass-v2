import type { LocaleDef } from "@/config/locales";
import type { GlossaryEntry } from "@/server/i18n/glossary";
import type { TranslatableField } from "@/server/i18n/field-map";

/** Bump on any change to the wording below; recorded on every artifact. */
export const TRANSLATION_PROMPT_VERSION = "2026-11-19.1";

const KIND_RULES: Record<TranslatableField["kind"], string> = {
  title:
    "A headline. Keep it tight and readable as a headline in the target language — do not pad it out to match English word order. No trailing period.",
  summary:
    "A meta description / card excerpt. It must stand alone out of context and stay close to the source length, because the layout and search snippets budget for it.",
  markdown:
    "Markdown body text. Preserve the structure EXACTLY: same heading levels and count, same list items, same table rows, same link count with identical URLs. Translate link text; never translate a URL. Do not add or remove sections, and do not introduce code fences.",
  label:
    "A short UI label rendered in a fixed slot. Prefer the shortest natural form; a long translation will overflow or wrap badly.",
  phrase:
    "One or two sentences of prose. Translate the meaning, not the word order.",
  // Money fields are reformatted deterministically by the pipeline and never
  // reach the model (see `server/i18n/money.ts`). The entry exists only so the
  // kind map stays total against `TranslatableField["kind"]`.
  money: "Handled by the pipeline; not sent for translation.",
};

export function buildSystemPrompt(locale: LocaleDef): string {
  const currency =
    locale.currency.position === "suffix"
      ? `the amount followed by "${locale.currency.unit}" (e.g. "4,283.61 ${locale.currency.unit}")`
      : `"${locale.currency.unit}" immediately before the amount (e.g. "${locale.currency.unit}4,283.61")`;

  return [
    `You are a professional financial translator localizing an educational gold-investing site from English into ${locale.englishLabel} (${locale.label}).`,
    "",
    "The site publishes market analysis that people may act on financially. A mistranslated number, direction, or hedge is a factual error, not a stylistic one. Accuracy outranks fluency; fluency outranks literalness.",
    "",
    "## Absolute rules",
    "",
    "1. NEVER change a number. Every digit, decimal separator, thousands separator, percentage and date must survive exactly. If the source says 4,283.61 the translation says 4,283.61.",
    "2. NEVER change direction or magnitude. 'rose' must not become 'fell'; 'may' must not become 'will'; a hedge must stay hedged. If the source expresses uncertainty, so must you.",
    "3. NEVER add information. No extra context, no explanations the source did not give, no examples of your own. If a sentence is unclear, translate it as it is.",
    "4. NEVER remove information. Every claim, caveat and disclaimer in the source must appear in the translation.",
    "5. NEVER translate a URL, and never change one.",
    "6. Preserve Markdown structure exactly: heading levels, list items, tables, emphasis, and link targets.",
    "7. Preserve interpolation tokens and inline tags exactly. `{name}` and `%s` are filled in by the site and must appear verbatim. Tags such as `<trends>…</trends>` or `<strong>…</strong>` mark a link or emphasis: keep every tag pair, never rename or translate a tag name, and translate only the words between the tags. You may move a tag pair within the sentence when word order requires it, as long as it still wraps the words with the same meaning.",
    `8. Some strings are ICU plural messages: \`{count, plural, one {…} other {…}}\`. Keep the \`{count, plural,\` wrapper and the argument names exactly; never translate the keywords "plural", "select" or the branch names. Write one branch per plural category the target language uses — for ${locale.englishLabel}: ${new Intl.PluralRules(locale.code).resolvedOptions().pluralCategories.join(", ")} (always including "other"), translating only the text inside each branch. Keep every \`{argument}\` from the source in the branches where the number is shown; a branch may omit it only when the word itself states the number (e.g. "one minute").`,
    "",
    "## Numerals and currency",
    "",
    "- Write all numbers with WESTERN ARABIC (Latin) digits: 0123456789. Do not use Eastern Arabic-Indic numerals.",
    "- Keep every number in the FORM the source uses. A number the source writes as digits stays digits — never spell it out as a word, even when the word would be more idiomatic, and including small numbers inside compounds: \"20-day return\" keeps \"20\", \"2 cents\" keeps \"2\", \"the 20th month\" keeps \"20\". A number the source writes as a word stays a word — \"Twenty-day volatility\" must not become \"20\". An automated check compares the digits in the source and the translation and rejects any difference, in either direction.",
    "- The numbers most often lost are the small round ones inside time spans and maturities, because the target language has a natural word for them. Write the digits anyway: \"30-day\" → \"30 يومًا\" (not ثلاثين), \"20-day\" / \"90-day\" → \"20 يومًا\" / \"90 يومًا\" (not عشرين / تسعين), \"10-year yield\" → \"لأجل 10 سنوات\" (not عشر), \"1–4 weeks\" → \"1–4 أسابيع\" (not أسبوع إلى أربعة), \"3 months\" → \"3 أشهر\" (not ثلاثة). A dual form (يومين، سنتين، شهرين) drops the digit, so use it only where the source has no digit. The same applies in every target language with number words or a dual form.",
    "- Before you return, check each field: every number in its source must appear in your translation of that field, as digits, the same number of times — no more, no fewer.",
    `- Write USD amounts as ${currency}.`,
    "- Keep ranges and their dash characters as they appear in the source.",
    "",
    "## Terminology",
    "",
    "The glossary supplied with each request is binding. Where a listed English term appears in the source, its approved rendering must appear in your translation. These are house terms chosen by a native-speaking subject expert; do not substitute a synonym you prefer.",
    "",
    "Terms in the do-not-translate list must appear verbatim, in Latin script, exactly as written.",
    "",
    "## Output",
    "",
    "You will receive a JSON object mapping field paths to English strings. Return a JSON object with EXACTLY the same keys and no others, whose values are the translations. Return only the JSON object — no prose, no code fences, no commentary.",
  ].join("\n");
}

export function buildUserPrompt(
  fields: TranslatableField[],
  glossary: GlossaryEntry[],
  doNotTranslate: string[],
): string {
  const parts: string[] = [];

  if (glossary.length > 0) {
    parts.push(
      "## Glossary (binding)",
      "",
      ...glossary.map(
        (g) =>
          `- "${g.en}" → ${g.target}` +
          (g.accepted.length > 1
            ? `  (inflected forms acceptable: ${g.accepted.slice(1).join(", ")})`
            : ""),
      ),
      "",
    );
  }

  if (doNotTranslate.length > 0) {
    parts.push(
      "## Do not translate (keep verbatim, Latin script)",
      "",
      doNotTranslate.join(", "),
      "",
    );
  }

  // Per-field guidance, listed once per kind actually present rather than
  // repeated on every field — the same instruction restated 26 times dilutes it.
  const kinds = [...new Set(fields.map((f) => f.kind))];
  parts.push("## Field kinds", "");
  for (const kind of kinds) {
    parts.push(`- **${kind}**: ${KIND_RULES[kind]}`);
  }
  parts.push("");

  parts.push(
    "## Fields to translate",
    "",
    "Each key below is a field path; the object gives its kind and its English text.",
    "",
    "```json",
    JSON.stringify(
      Object.fromEntries(
        fields.map((f) => [f.path, { kind: f.kind, text: f.value }]),
      ),
      null,
      2,
    ),
    "```",
    "",
    `Return a JSON object with exactly these ${fields.length} keys, mapping each path directly to its translated string.`,
  );

  return parts.join("\n");
}

export type NumeralRepairItem = {
  path: string;
  source: string;
  translation: string;
  /** Numbers (digits only, separators stripped) the source has more often than the translation. */
  missing: string[];
  /** Numbers the translation has that the source does not. */
  extra: string[];
  /** The translation contains Eastern Arabic-Indic digits. */
  indic: boolean;
};

/**
 * The follow-up request for fields whose numbers changed in translation.
 *
 * Tells the model precisely what is wrong in each field instead of asking it to
 * look again: a vague "check your numbers" is what the original prompt already
 * says. Numbers are listed without separators because that is how the check
 * compares them — "4121" means 4,121 wherever it appears.
 */
export function buildNumeralRepairPrompt(items: NumeralRepairItem[]): string {
  const describe = (item: NumeralRepairItem): string => {
    const lines: string[] = [];
    if (item.missing.length > 0) {
      lines.push(
        `missing from your translation: ${item.missing.join(", ")} — the source writes these as digits. ` +
          `You most likely wrote them as words or as a dual form; write the digits instead.`,
      );
    }
    if (item.extra.length > 0) {
      lines.push(
        `in your translation but not in the source: ${item.extra.join(", ")} — the source writes these as ` +
          `words (or not at all). Keep them as words, as the source does, or remove anything you added.`,
      );
    }
    if (item.indic) {
      lines.push("uses Eastern Arabic-Indic digits; use 0123456789 only.");
    }
    return lines.map((l) => `  - ${l}`).join("\n");
  };

  return [
    "An automated check compared the numbers in your translation with the English source and found differences in the fields below. Numbers are listed with separators removed (\"4121\" means 4,121).",
    "",
    "For each field, return the corrected translation. Change ONLY what is needed to make its numbers match the source exactly — same numbers, written as digits, the same number of times. Keep every other word, the Markdown structure, links and tags exactly as in your translation.",
    "",
    ...items.flatMap((item) => [
      `### ${item.path}`,
      describe(item),
      "",
      "English source:",
      "```",
      item.source,
      "```",
      "",
      "Your translation:",
      "```",
      item.translation,
      "```",
      "",
    ]),
    `Return a JSON object with exactly these ${items.length} keys (${items.map((i) => i.path).join(", ")}), each mapping to its complete corrected translation. Return only the JSON object — no prose, no code fences.`,
  ].join("\n");
}
