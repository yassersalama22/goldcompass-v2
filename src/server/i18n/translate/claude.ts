import { z } from "zod";

import { loadGlossary, glossaryForText } from "@/server/i18n/glossary";
import { generateJson, parseEffort } from "@/server/llm/grounded-json";
import { stripHtml } from "@/server/llm/sanitize";
import { buildSystemPrompt, buildUserPrompt, TRANSLATION_PROMPT_VERSION } from "./prompt";
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
    async translate({ locale, fields }: TranslationRequest): Promise<TranslationResult> {
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
      // so a model can never put HTML into stored content.
      const sanitized = Object.fromEntries(
        Object.entries(values).map(([path, text]) => [path, stripHtml(text)]),
      );

      return { values: sanitized, model, promptVersion: TRANSLATION_PROMPT_VERSION };
    },
  };
}
