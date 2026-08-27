import type { LocaleDef } from "@/config/locales";
import type { GlossaryEntry } from "@/server/i18n/glossary";
import type { TranslatableField } from "@/server/i18n/field-map";

/** Bump on any change to the wording below; recorded on every artifact. */
export const TRANSLATION_PROMPT_VERSION = "2026-08-27.1";

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
    "",
    "## Numerals and currency",
    "",
    "- Write all numbers with WESTERN ARABIC (Latin) digits: 0123456789. Do not use Eastern Arabic-Indic numerals.",
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
