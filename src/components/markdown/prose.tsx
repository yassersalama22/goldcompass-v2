import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Markdown as styled React elements. react-markdown does NOT use
 * dangerouslySetInnerHTML and we do not enable raw-HTML plugins, so
 * model/editorial content cannot inject scripts. Shared by the outlook and
 * articles. (No typography plugin — elements are styled explicitly.)
 */
const components: Components = {
  h2: (props) => (
    <h2 className="mt-10 mb-3 text-2xl font-bold first:mt-0" {...props} />
  ),
  h3: (props) => <h3 className="mt-6 mb-2 text-lg font-semibold" {...props} />,
  p: (props) => <p className="text-foreground/90 my-4 leading-7" {...props} />,
  ul: (props) => (
    <ul className="text-foreground/90 marker:text-gold-strong my-4 list-disc space-y-2 ps-6" {...props} />
  ),
  ol: (props) => (
    <ol className="text-foreground/90 my-4 list-decimal space-y-2 ps-6" {...props} />
  ),
  li: (props) => <li className="leading-7" {...props} />,
  strong: (props) => <strong className="text-foreground font-semibold" {...props} />,
  /*
   * Internal and external links are treated differently, and the difference
   * matters for SEO.
   *
   * External links are citations to other people's pages: new tab, and
   * `nofollow` so we are not passing authority to sources we merely reference.
   * Internal links are our own site: same tab, and **never `nofollow`** —
   * nofollowing your own pages tells search engines not to follow your internal
   * link graph, which is the opposite of what it is for. This became live the
   * moment long-form prose with internal links moved into Markdown artifacts.
   */
  a: ({ href, ...props }) => {
    const external = !!href && !href.startsWith("/") && !href.startsWith("#");
    return (
      <a
        href={href}
        className="text-gold-strong font-medium underline underline-offset-4"
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer nofollow" }
          : {})}
        {...props}
      />
    );
  },
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border-border border-b px-3 py-2 text-start font-semibold" {...props} />
  ),
  td: (props) => <td className="border-border border-b px-3 py-2" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-gold/40 text-muted-foreground my-4 border-s-4 ps-4 italic"
      {...props}
    />
  ),
};

export function Prose({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
