import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the analysis Markdown as styled React elements. react-markdown does
 * NOT use dangerouslySetInnerHTML and we do not enable raw-HTML plugins, so
 * model/editorial content cannot inject scripts. (No typography plugin — we
 * style elements explicitly to match the design system.)
 */
const components: Components = {
  h2: (props) => (
    <h2 className="mt-10 mb-3 text-2xl font-bold first:mt-0" {...props} />
  ),
  h3: (props) => <h3 className="mt-6 mb-2 text-lg font-semibold" {...props} />,
  p: (props) => <p className="text-foreground/90 my-4 leading-7" {...props} />,
  ul: (props) => (
    <ul className="my-4 list-disc space-y-2 pl-6 marker:text-gold-strong" {...props} />
  ),
  ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6" {...props} />,
  li: (props) => <li className="text-foreground/90 leading-7" {...props} />,
  strong: (props) => <strong className="text-foreground font-semibold" {...props} />,
  a: (props) => (
    <a
      className="text-gold-strong font-medium underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer nofollow"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-border border-b px-3 py-2 text-left font-semibold"
      {...props}
    />
  ),
  td: (props) => <td className="border-border border-b px-3 py-2" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-gold/40 text-muted-foreground my-4 border-l-4 pl-4 italic"
      {...props}
    />
  ),
};

export function Analysis({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
