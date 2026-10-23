import { PAGE_CONTRACT_VERSION, pageSchema, type PageDoc } from "@/types/page";

/**
 * Page artifacts as Markdown-with-frontmatter, both directions.
 *
 * Shared by the server data layer (`server/pages`) and the translation
 * pipeline (`scripts/translate-content.mts`), which runs under tsx outside Next
 * and so cannot import a `server-only` module. One parser and one serializer,
 * so what the pipeline writes is exactly what the site reads.
 */

/**
 * Minimal frontmatter parser.
 *
 * Deliberately not a YAML library. The frontmatter here is a fixed set of
 * flat `key: value` strings — no nesting, no lists, no anchors — so a real YAML
 * parser would be a dependency (and a parsing surface) bought for nothing. The
 * one thing it must handle is values containing colons, which is why the split
 * is on the *first* colon only.
 *
 * Values may be quoted to protect leading/trailing whitespace or a leading `#`;
 * quotes are stripped. Anything more elaborate than that belongs in the body.
 */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("Page artifact is missing its frontmatter block.");
  }
  const [, head, body] = match;

  const data: Record<string, string> = {};
  for (const line of head.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: body.trim() };
}

/**
 * Frontmatter is flat by design, so a translation's metadata object is stored
 * as dotted keys (`translation.sourceHash: …`) and regrouped on read.
 */
const NESTED = "translation.";

export function parsePageMarkdown(raw: string, slug: string): PageDoc {
  const { data, body } = parseFrontmatter(raw);
  const flat: Record<string, string> = {};
  const translation: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(NESTED)) translation[key.slice(NESTED.length)] = value;
    else flat[key] = value;
  }
  return pageSchema.parse({
    contractVersion: PAGE_CONTRACT_VERSION,
    slug,
    ...flat,
    ...(Object.keys(translation).length > 0 ? { translation } : {}),
    bodyMarkdown: body,
  });
}

/**
 * Serialize a page back to Markdown. Values are always double-quoted: the
 * parser strips one pair of surrounding quotes, so quoting protects a value that
 * starts with `#`, contains leading/trailing space, or is itself quoted. A
 * newline in a value would break the line-based format, so it is rejected
 * rather than silently mangled.
 */
export function serializePageMarkdown(page: PageDoc): string {
  // `slug` comes from the filename and `contractVersion` is implied by the
  // parser, so neither is written into the frontmatter.
  const OMIT = new Set(["slug", "contractVersion", "bodyMarkdown", "translation"]);
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(page)) {
    if (!OMIT.has(key) && value !== undefined) entries.push([key, String(value)]);
  }
  const { bodyMarkdown, translation } = page;
  for (const [key, value] of Object.entries(translation ?? {})) {
    entries.push([`${NESTED}${key}`, String(value)]);
  }
  const lines = entries.map(([key, value]) => {
    if (/[\r\n]/.test(value)) {
      throw new Error(`Frontmatter value for "${key}" contains a newline.`);
    }
    return `${key}: "${value}"`;
  });
  return `---\n${lines.join("\n")}\n---\n\n${bodyMarkdown.trim()}\n`;
}
