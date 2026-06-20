import type { GeneratedOutlook, GenerationInput } from "./schema";

/**
 * Generation provider abstraction (mirrors the price-provider pattern). The
 * pipeline depends on this interface, not on a specific LLM — swap Claude for
 * another model/provider without touching the orchestration.
 */
export interface OutlookGenerator {
  readonly name: string;
  /** Produce a structured outlook grounded in the supplied market data. */
  generate(input: GenerationInput): Promise<GeneratedOutlook>;
}
