import { Prose } from "@/components/markdown/prose";

/** Outlook analysis = shared Markdown renderer. */
export function Analysis({ markdown }: { markdown: string }) {
  return <Prose markdown={markdown} />;
}
