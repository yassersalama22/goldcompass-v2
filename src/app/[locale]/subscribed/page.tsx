import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { Check, Compass, LineChart, Calculator, Newspaper } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/**
 * Landing page for the newsletter provider's "after confirming" redirect —
 * every double-opt-in subscriber lands here after clicking the confirm link in
 * their email. Deliberately `noindex` (thin, no search intent) and kept out of
 * `sitemap.ts`; it exists to bring a fresh subscriber straight into the content.
 */
const pageMetadata: Metadata = {
  title: "You're subscribed",
  description:
    "Your subscription to the GoldCompass weekly gold update is confirmed.",
  robots: { index: false, follow: true },
};

const nextSteps = [
  {
    icon: Compass,
    title: "Market Outlook",
    href: "/outlook",
    body: "Today's short- and long-term gold signals, with the reasoning and key levels behind them.",
  },
  {
    icon: LineChart,
    title: "Live Price & Trends",
    href: "/trends",
    body: "The current spot price and an interactive 30-day chart of where gold has been.",
  },
  {
    icon: Calculator,
    title: "Smart Gold Calculator",
    href: "/calculator",
    body: "Turn a budget into real numbers — quantity, break-even after premiums, and P/L scenarios.",
  },
  {
    icon: Newspaper,
    title: "Market Insights",
    href: "/insights",
    body: "Educational guides and news analysis on prices, central banks, and the macro picture.",
  },
];

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/subscribed", locale);
}

export default async function SubscribedPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Container className="py-12 sm:py-16">
      {/* Confirmation */}
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="bg-bull/10 mx-auto flex size-14 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <Check className="text-bull size-7" strokeWidth={2.5} />
        </div>

        <h1 className="mt-6 text-3xl font-bold text-balance sm:text-4xl">
          You&rsquo;re subscribed
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          Your email is confirmed. You&rsquo;ll get the {siteConfig.name} weekly
          gold update — the latest outlook, notable price moves, and the key
          levels worth watching.
        </p>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          No spam, and you can unsubscribe from any email in one click.
        </p>
      </div>

      {/* Start reading */}
      <section aria-labelledby="start-reading" className="mx-auto mt-14 max-w-4xl">
        <h2 id="start-reading" className="text-center text-2xl font-bold">
          Start here
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {nextSteps.map(({ icon: Icon, title, href, body }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-6 text-gold-strong" aria-hidden="true" />
              <h3 className="mt-3 font-semibold group-hover:text-gold-strong">{title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm text-pretty">{body}</p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center">
          <Button render={<Link href="/outlook" />} size="lg">
            Read the latest outlook
          </Button>
        </p>
      </section>

      {/* Disclaimer */}
      <section className="mx-auto mt-14 max-w-4xl">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p>
            <strong>Important:</strong> {siteConfig.name} provides educational
            information only — not financial, investment, tax, or legal advice.
            Always do your own research before investing. Read our full{" "}
            <Link href="/disclaimer" className="font-medium underline underline-offset-4">
              disclaimer
            </Link>
            .
          </p>
        </div>
      </section>
    </Container>
  );
}
