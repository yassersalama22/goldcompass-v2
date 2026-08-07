import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronRight, AlertTriangle } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { Card, CardContent } from "@/components/ui/card";
import { FLAGSHIP_TOOL, siblingTools, type ToolDef } from "@/config/tools";
import {
  breadcrumbSchema,
  faqSchema,
  toolApplicationSchema,
} from "@/lib/structured-data";

export interface ToolFaq {
  question: string;
  answer: string;
}

interface Props {
  tool: ToolDef;
  /** Lead paragraph under the h1. */
  intro: string;
  /** The interactive calculator. */
  children: ReactNode;
  /** Explanatory prose — the formula and a worked example at a real price. */
  about: ReactNode;
  mistakes: { title: string; body: ReactNode }[];
  /**
   * Rendered visibly *and* emitted as FAQPage JSON-LD from the same array, so
   * the markup can never drift from what the page shows.
   */
  faqs: ToolFaq[];
  /** Locale of the page rendering this shell — forwarded into the JSON-LD so
   *  its URLs and `inLanguage` match the page they describe. */
  locale: string;
}

export function ToolPageShell({
  tool,
  intro,
  children,
  about,
  mistakes,
  faqs,
  locale,
}: Props) {
  const siblings = siblingTools(tool.slug);

  return (
    <>
      <JsonLd
        data={[
          toolApplicationSchema(tool, locale),
          faqSchema(faqs, locale),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Gold Calculator", path: FLAGSHIP_TOOL.href },
            { name: tool.name, path: tool.href },
          ], locale),
        ]}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs current={tool.shortName} />

        <div className="mb-8 max-w-2xl">
          <p className="text-gold-strong mb-2 text-sm font-medium">Gold tools</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{tool.name}</h1>
          <p className="text-muted-foreground mt-3">{intro}</p>
          <p className="mt-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Educational purposes only — not financial advice.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-10">
            {children}

            <section aria-labelledby="about-heading" className="space-y-4">
              <h2 id="about-heading" className="text-2xl font-bold">
                How this calculator works
              </h2>
              <div className="text-foreground/90 space-y-4 leading-7">{about}</div>
            </section>

            {mistakes.length > 0 ? (
              <section aria-labelledby="mistakes-heading" className="space-y-4">
                <h2 id="mistakes-heading" className="text-2xl font-bold">
                  Common mistakes
                </h2>
                <ul className="space-y-3">
                  {mistakes.map((mistake) => (
                    <li
                      key={mistake.title}
                      className="border-border bg-muted/40 flex gap-3 rounded-xl border px-4 py-3"
                    >
                      <AlertTriangle
                        className="text-gold-strong mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 text-sm">
                        <p className="text-foreground font-semibold">{mistake.title}</p>
                        <p className="text-muted-foreground mt-1 leading-6">{mistake.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="faq-heading" className="space-y-4">
              <h2 id="faq-heading" className="text-2xl font-bold">
                Frequently asked questions
              </h2>
              <dl className="divide-border divide-y border-t border-b">
                {faqs.map((faq) => (
                  <div key={faq.question} className="py-4">
                    <dt className="font-semibold">{faq.question}</dt>
                    <dd className="text-muted-foreground mt-2 leading-7">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="text-muted-foreground border-t pt-6 text-sm">
              Figures are estimates for educational use and exclude taxes, shipping, insurance,
              and storage. Read our{" "}
              <Link href="/methodology" className="text-gold-strong underline underline-offset-4">
                methodology
              </Link>{" "}
              and{" "}
              <Link href="/disclaimer" className="text-gold-strong underline underline-offset-4">
                disclaimer
              </Link>
              .
            </p>
          </div>

          <ToolSidebar siblings={siblings} />
        </div>
      </Container>
    </>
  );
}

function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        <li>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <li>
          <Link href={FLAGSHIP_TOOL.href} className="hover:text-foreground">
            Gold Calculator
          </Link>
        </li>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <li className="text-foreground font-medium" aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  );
}

function ToolSidebar({ siblings }: { siblings: ToolDef[] }) {
  return (
    <aside aria-labelledby="other-tools-heading" className="lg:sticky lg:top-20 lg:self-start">
      <Card>
        <CardContent>
          <h2 id="other-tools-heading" className="text-sm font-semibold">
            Other gold tools
          </h2>
          <ul className="mt-3 space-y-3">
            {siblings.map((tool) => (
              <li key={tool.slug}>
                <Link href={tool.href} className="group block">
                  <span className="group-hover:text-gold-strong text-sm font-medium underline-offset-4 group-hover:underline">
                    {tool.shortName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-5">
                    {tool.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-border mt-4 border-t pt-4">
            <Link href={FLAGSHIP_TOOL.href} className="group block">
              <span className="group-hover:text-gold-strong text-sm font-medium underline-offset-4 group-hover:underline">
                {FLAGSHIP_TOOL.shortName}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-5">
                {FLAGSHIP_TOOL.description}
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
