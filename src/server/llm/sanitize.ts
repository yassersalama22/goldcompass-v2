/**
 * Strip HTML-like tags from Markdown (defense-in-depth). react-markdown does
 * not execute raw HTML, but we keep stored artifacts as plain Markdown to close
 * the indirect prompt-injection → stored-HTML vector. `<` followed by a space
 * (e.g. "a < b") is preserved; only tag-shaped sequences are removed.
 */
export function stripHtml(markdown: string, keepTags: ReadonlySet<string> = NO_TAGS): string {
  return markdown
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g, (tag, name: string, rest: string) =>
      keepTags.has(name) && rest === "" ? tag : "",
    )
    .trim();
}

const NO_TAGS: ReadonlySet<string> = new Set();

/**
 * Names of the bare rich-text tags in a string (`<trends>`, `</strong>` →
 * `trends`, `strong`). Used to build `stripHtml`'s allowlist from the SOURCE
 * text of a catalog message, so a translation may keep exactly the tags its
 * English original had — and nothing a model invents. Kept tags are never
 * emitted as HTML: next-intl's `t.rich()` maps each name to one of our own
 * render functions (`@/i18n/rich`), and only attribute-free tags survive.
 */
export function richTagNames(text: string): Set<string> {
  return new Set([...text.matchAll(/<\/?([a-zA-Z][\w-]*)>/g)].map((m) => m[1]!));
}
