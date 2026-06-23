/**
 * Strip HTML-like tags from Markdown (defense-in-depth). react-markdown does
 * not execute raw HTML, but we keep stored artifacts as plain Markdown to close
 * the indirect prompt-injection → stored-HTML vector. `<` followed by a space
 * (e.g. "a < b") is preserved; only tag-shaped sequences are removed.
 */
export function stripHtml(markdown: string): string {
  return markdown
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .trim();
}
