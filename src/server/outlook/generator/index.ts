import { createMockGenerator } from "./mock";
import type { OutlookGenerator } from "./provider";

export { PROMPT_VERSION } from "./prompt";
export { sanitizeGenerated } from "./sanitize";
export { generatedOutlookSchema } from "./schema";
export type { GeneratedOutlook, GenerationInput } from "./schema";
export type { OutlookGenerator } from "./provider";

/**
 * Select the generator. Uses Claude when ANTHROPIC_API_KEY is set (and not
 * explicitly mocked), otherwise the deterministic mock — so the pipeline runs
 * offline/in CI without a key. The Claude module is imported lazily so the SDK
 * isn't required when running the mock.
 */
export async function getOutlookGenerator(): Promise<OutlookGenerator> {
  const useMock = process.env.OUTLOOK_GENERATOR === "mock" || !process.env.ANTHROPIC_API_KEY;
  if (useMock) return createMockGenerator();
  const { createClaudeGenerator } = await import("./claude");
  return createClaudeGenerator();
}
