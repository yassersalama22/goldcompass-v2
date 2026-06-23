/** Shared helpers for extracting JSON from LLM text responses. */

type TextLikeBlock = { type: string; text?: string };

/** Concatenate the text blocks of an assistant message. */
export function extractText(content: TextLikeBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Pull a JSON object out of a text blob (tolerates stray fences/prose). */
export function parseJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) s = s.slice(first, last + 1);
  }
  return JSON.parse(s);
}
