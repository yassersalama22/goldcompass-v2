import { z } from "zod";

import { loadGlossary, glossaryForText } from "@/server/i18n/glossary";
import { generateJson, parseEffort } from "@/server/llm/grounded-json";
import { ARABIC_INDIC, numeralDiff } from "@/server/i18n/numerals";
import { richTagNames, stripHtml } from "@/server/llm/sanitize";
import {
  buildNumeralRepairPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  TRANSLATION_PROMPT_VERSION,
} from "./prompt";
import type { TranslationProvider, TranslationRequest, TranslationResult } from "./provider";

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Claude-backed translator.
 *
 * Deliberately runs with **no web search**: a translator that can browse could
 * import claims that were never in the source, which is exactly the failure the
 * whole field-map design exists to prevent. It gets the text and the glossary,
 * nothing else.
 */
export function createClaudeTranslationProvider(): TranslationProvider {
  const model = process.env.TRANSLATE_MODEL || DEFAULT_MODEL;
  const effort = parseEffort(process.env.TRANSLATE_EFFORT, "medium");

  return {
    name: `claude:${model}`,
    async translate({ locale, fields, exactNumerals }: TranslationRequest): Promise<TranslationResult> {
      const glossary = loadGlossary(locale.code);
      const corpus = fields.map((f) => f.value).join("\n");

      // The response shape is derived from the request: exactly the requested
      // keys, all strings. A missing or invented key fails validation and takes
      // the one corrective retry in `generateJson`, rather than silently
      // producing a half-translated artifact.
      const shape = Object.fromEntries(
        fields.map((f) => [f.path, z.string().min(1)]),
      ) as Record<string, z.ZodString>;
      const schema = z.object(shape).strict();

      const values = await generateJson(
        buildSystemPrompt(locale),
        buildUserPrompt(
          fields,
          glossary ? glossaryForText(glossary, corpus) : [],
          glossary?.doNotTranslate ?? [],
        ),
        schema,
        { model, effort, webSearchMaxUses: 0, maxTokens: 32000 },
      );

      // Same defense-in-depth as the generators: artifacts stay plain Markdown,
      // so a model can never put HTML into stored content. The one exception is
      // a catalog's rich-text tags: a field may keep the bare tags its own
      // English source carries (stripping them silently deleted every link on
      // the translated page), and nothing else.
      const sourceByPath = new Map(fields.map((f) => [f.path, f.value]));
      const sanitized = Object.fromEntries(
        Object.entries(values).map(([path, text]) => [
          path,
          stripHtml(text, richTagNames(sourceByPath.get(path) ?? "")),
        ]),
      );

      if (exactNumerals) {
        // Low effort: the repair is mechanical (the request names the exact
        // numbers to restore), and at the translation's own effort a single
        // long Markdown field took minutes of thinking.
        await repairNumerals(locale, fields, sanitized, (system, user, repairSchema) =>
          generateJson(system, user, repairSchema, {
            model,
            effort: "low",
            webSearchMaxUses: 0,
            maxTokens: 32000,
          }),
        );
      }

      return { values: sanitized, model, promptVersion: TRANSLATION_PROMPT_VERSION };
    },
  };
}

/** Repair passes after the first translation. Each costs one request, only for broken fields. */
const MAX_NUMERAL_REPAIRS = 2;

export type RepairCall = (
  system: string,
  user: string,
  schema: z.ZodType<Record<string, string>>,
) => Promise<Record<string, string>>;

/**
 * Re-ask for every field whose numbers no longer match its source, in place.
 *
 * Why this exists: the prompt already says "never spell a number out", and the
 * model still does it — about one daily outlook in five lost "30" to
 * "ثلاثين يومًا" or "10" to "لعشر سنوات" somewhere in ~70 numbers, and
 * `i18n:check` (correctly) failed the whole run. A rule restated in a prompt
 * cannot get that to zero; a mechanical check plus a targeted correction can.
 *
 * Only the broken fields are re-sent, each with its source, the current
 * translation, and exactly which numbers went missing or appeared — so the
 * request is small and the model is told what to fix rather than asked to look
 * for it. A repaired value is kept only if it has strictly fewer differences
 * than the one it replaces, so a bad repair can never make a field worse.
 *
 * This never relaxes the gate: whatever is still wrong after the last pass goes
 * to `i18n:check`, which fails the run exactly as before.
 */
export async function repairNumerals(
  locale: TranslationRequest["locale"],
  fields: TranslationRequest["fields"],
  values: Record<string, string>,
  call: RepairCall,
): Promise<void> {
  const sourceByPath = new Map(fields.map((f) => [f.path, f.value]));
  const problems = (path: string) => {
    const source = sourceByPath.get(path) ?? "";
    const text = values[path] ?? "";
    const diff = numeralDiff(source, text);
    const indic = ARABIC_INDIC.test(text);
    return { ...diff, indic, size: diff.missing.length + diff.extra.length + (indic ? 1 : 0) };
  };

  for (let pass = 1; pass <= MAX_NUMERAL_REPAIRS; pass++) {
    const broken = Object.keys(values)
      .map((path) => ({ path, ...problems(path) }))
      .filter((p) => p.size > 0);
    if (broken.length === 0) return;

    console.log(
      `[translate] numeral repair pass ${pass}: ${broken.length} field(s) — ` +
        broken
          .map((b) => `${b.path} (missing [${b.missing.join(", ")}], extra [${b.extra.join(", ")}])`)
          .join("; "),
    );

    const repairSchema = z
      .object(Object.fromEntries(broken.map((b) => [b.path, z.string().min(1)])))
      .strict() as unknown as z.ZodType<Record<string, string>>;

    let repaired: Record<string, string>;
    try {
      repaired = await call(
        buildSystemPrompt(locale),
        buildNumeralRepairPrompt(
          broken.map((b) => ({
            path: b.path,
            source: sourceByPath.get(b.path) ?? "",
            translation: values[b.path],
            missing: b.missing,
            extra: b.extra,
            indic: b.indic,
          })),
        ),
        repairSchema,
      );
    } catch (err) {
      console.warn(
        `[translate] numeral repair pass ${pass} failed (${(err as Error).message.split("\n")[0]}); keeping the current translation`,
      );
      return;
    }

    let fixed = 0;
    for (const b of broken) {
      const candidate = repaired[b.path];
      if (!candidate) continue;
      const before = values[b.path];
      values[b.path] = stripHtml(candidate, richTagNames(sourceByPath.get(b.path) ?? ""));
      if (problems(b.path).size < b.size) {
        if (problems(b.path).size === 0) fixed++;
      } else {
        values[b.path] = before; // never accept a repair that is not an improvement
      }
    }
    console.log(`[translate] numeral repair pass ${pass}: ${fixed} of ${broken.length} field(s) fixed`);
  }
}
