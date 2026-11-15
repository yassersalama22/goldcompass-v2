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
 *
 * `advisories` is the soft counterpart of `schema`. The schema holds rules a
 * response either meets or does not, and failing them fails the call. An
 * advisory is a judgement about prose (a pattern that *might* be a problem):
 * if a valid first response draws any, the model gets ONE chance to revise —
 * and if the revision is itself invalid, the valid first response is returned.
 * An advisory therefore costs at most one extra request and can never turn a
 * usable response into a failed run. Callers surface what remains to a human.
 * No advisory pass follows a schema retry: two requests is the ceiling.
 */
export async function generateJson<T>(
  system: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  opts: JsonRequestOptions,
  advisories?: (value: T) => string[],
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
    /*
     * Streamed, then awaited to completion — the callers still see one whole
     * Message, so nothing downstream changes.
     *
     * This is not a preference. The SDK refuses a *non*-streaming request whose
     * predicted duration exceeds 10 minutes, and that prediction scales with
     * `max_tokens`: a large batch (the 76-key UI catalog at 32k tokens) is
     * rejected before it is ever sent. Streaming lifts that ceiling, so the
     * token budget can be sized to the work rather than to an SDK guard.
     */
    const create = () =>
      client.messages
        .stream({
          model: opts.model,
          max_tokens: opts.maxTokens ?? 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: opts.effort },
          system,
          messages,
          tools: useSearch && searchBudget > 0 ? [webSearchTool] : undefined,
        })
        .finalMessage();

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

  let first: T;
  try {
    first = schema.parse(parseJsonObject(extractText(response.content)));
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

  const notes = advisories?.(first) ?? [];
  if (notes.length === 0) return first;

  messages.push({ role: "assistant", content: response.content });
  messages.push({
    role: "user",
    content:
      `Your response is valid. Before it is published, please reconsider these points:\n` +
      notes.map((note) => `- ${note}`).join("\n") +
      `\n\nIf a point is right, revise the wording. If it is a false alarm — the sentence already says ` +
      `the correct thing — leave it as it is. Change nothing else: keep every other field exactly as ` +
      `you wrote it. Respond with ONLY the complete JSON object — no prose, no code fences.`,
  });
  try {
    const revised = await runToCompletion(messages, false);
    return schema.parse(parseJsonObject(extractText(revised.content)));
  } catch (err) {
    console.warn(
      `[llm] advisory revision was not usable (${(err as Error).message.split("\n")[0]}); keeping the first response`,
    );
    return first;
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
  advisories?: (value: T) => string[],
): Promise<T> {
  return generateJson(system, userPrompt, schema, opts, advisories);
}
