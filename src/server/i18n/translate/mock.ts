import { TRANSLATION_PROMPT_VERSION } from "./prompt";
import type { TranslationProvider, TranslationRequest, TranslationResult } from "./provider";

/**
 * Deterministic offline translator.
 *
 * Produces text that is obviously not a translation while remaining *valid*
 * against every rule `i18n:check` enforces — numbers, URLs, Markdown structure
 * and do-not-translate terms all survive, because the source is passed through
 * with a locale tag prepended. That lets the whole pipeline and its checks run
 * in CI with no API key, and makes an accidentally published mock artifact
 * unmistakable rather than plausible.
 */
export function createMockTranslationProvider(): TranslationProvider {
  return {
    name: "mock",
    async translate({ locale, fields }: TranslationRequest): Promise<TranslationResult> {
      const values = Object.fromEntries(
        fields.map((f) => [
          f.path,
          // Markdown gets the tag on its own line: prefixing inline turns a
          // leading `## Heading` into body text and trips the structure check,
          // which is a defect in the fixture rather than in the content.
          f.kind === "markdown"
            ? `[${locale.code}]\n\n${f.value}`
            : `[${locale.code}] ${f.value}`,
        ]),
      );
      return { values, model: "mock", promptVersion: TRANSLATION_PROMPT_VERSION };
    },
  };
}
