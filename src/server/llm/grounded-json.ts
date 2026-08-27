import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

import { extractText, parseJsonObject } from "./json";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export function parseEffort(value: string | undefined, fallback: Effort): Effort {
  return EFFORTS.includes(value as Effort) ? (value as Effort) : fallback;
}

export type JsonRequestOptions = {
  model: string;
  effort: Effort;
  maxTokens?: number;
  /**
   * Web-search budget. `0` omits the tool entirely, which is the right setting
   * for any task that must reason only about text it was given — translation
   * being the obvious one: a translator that can browse can import claims that
   * were never in the source.
   */
  webSearchMaxUses?: number;
};

/** Back-compat alias for the two generators that predate the split. */
export type GroundedJsonOptions = JsonRequestOptions & {
  webSearchMaxUses: number;
};

const MAX_PAUSE_CONTINUATIONS = 4;

/**
 * Run a Claude request that must return one JSON object, validate it against
 * `schema`, and retry **once** — with search disabled and the validation error
 * fed back — if the first attempt does not conform.
 *
 * Shared by the outlook generator, the article generator and the translator, so
 * the SDK/tool/pause-turn/retry logic lives in exactly one place. The only
 * difference between callers is whether the web-search tool is attached.
 */
export async function generateJson<T>(
  system: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  opts: JsonRequestOptions,
): Promise<T> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const searchBudget = opts.webSearchMaxUses ?? 0;

  const webSearchTool = {
    type: "web_search_20260209" as const,
    name: "web_search" as const,
    max_uses: searchBudget,
  };

  async function runToCompletion(
    messages: Anthropic.MessageParam[],
    useSearch: boolean,
  ): Promise<Anthropic.Message> {
    const create = () =>
      client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort },
        system,
        messages,
        tools: useSearch && searchBudget > 0 ? [webSearchTool] : undefined,
      });

    let response = await create();
    let continuations = 0;
    while (
      response.stop_reason === "pause_turn" &&
      continuations < MAX_PAUSE_CONTINUATIONS
    ) {
      messages.push({ role: "assistant", content: response.content });
      response = await create();
      continuations++;
    }
    if (response.stop_reason === "refusal") {
      throw new Error("Claude refused the request.");
    }
    return response;
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  const response = await runToCompletion(messages, true);

  try {
    return schema.parse(parseJsonObject(extractText(response.content)));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content:
        `Your previous response was not valid JSON matching the required schema. ` +
        `Error: ${reason}. Respond with ONLY the corrected JSON object — no prose, no code fences.`,
    });
    const retry = await runToCompletion(messages, false);
    return schema.parse(parseJsonObject(extractText(retry.content)));
  }
}

/**
 * Web-search-grounded variant. Identical to `generateJson` with a search budget;
 * kept as a named export because "grounded" is the meaningful distinction at the
 * call sites that use it (§12: retrieval separated from reasoning).
 */
export async function generateGroundedJson<T>(
  system: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  opts: GroundedJsonOptions,
): Promise<T> {
  return generateJson(system, userPrompt, schema, opts);
}
