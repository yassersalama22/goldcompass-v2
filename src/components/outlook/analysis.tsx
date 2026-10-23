import { Prose } from "@/components/markdown/prose";
import type { ContentLang } from "@/server/i18n/availability";

/** Outlook analysis = shared Markdown renderer. */
export function Analysis({ markdown, content = {} }: { markdown: string; content?: ContentLang }) {
  const prose = <Prose markdown={markdown} />;
  // Only wrap when marking a fallback, so translated/English output is unchanged.
  return content.lang ? <div {...content}>{prose}</div> : prose;
}
