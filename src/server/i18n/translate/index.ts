import { createMockTranslationProvider } from "./mock";
import type { TranslationProvider } from "./provider";

export { TRANSLATION_PROMPT_VERSION } from "./prompt";
export type { TranslationProvider, TranslationRequest, TranslationResult } from "./provider";

/**
 * Select the translator: Claude when `ANTHROPIC_API_KEY` is set and the mock has
 * not been forced, otherwise the deterministic offline mock. The Claude module
 * is imported lazily so the SDK is not required on the mock path.
 *
 * Same selection rule as the outlook and article generators.
 */
export async function getTranslationProvider(): Promise<TranslationProvider> {
  const useMock =
    process.env.TRANSLATE_PROVIDER === "mock" || !process.env.ANTHROPIC_API_KEY;
  if (useMock) return createMockTranslationProvider();
  const { createClaudeTranslationProvider } = await import("./claude");
  return createClaudeTranslationProvider();
}
