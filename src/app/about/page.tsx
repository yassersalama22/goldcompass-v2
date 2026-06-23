import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, Calculator, Newspaper, Compass, ShieldCheck, BookOpen } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { Button } from "@/components/ui/button";
import { aboutPageSchema } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "GoldCompass provides clear, independent, educational gold-investing guidance — grounded in real market data, with cited sources and human review.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About ${siteConfig.name}`,
    description:
      "Clear, independent, educational gold-investing guidance — grounded in data and cited sources.",
    url: "/about",
    type: "website",
  },
};

const whatWeDo = [
  {
    icon: Compass,
    title: "Market Outlook",
    href: "/outlook",
    body: "Short- and long-term gold signals with the reasoning, key price levels, and invalidation points laid out — never just a verdict.",
  },
  {
    icon: LineChart,
    title: "Live Price & Trends",
    href: "/trends",
    body: "The current XAU/USD spot price and an interactive 30-day chart, so you can see what the market is actually doing.",
  },
  {
    icon: Calculator,
    title: "Smart Gold Calculator",
    href: "/calculator",
    body: "Turn a budget into real numbers: how much gold you can buy at any purity, your break-even after premiums, and profit/loss scenarios.",
  },
  {
    icon: Newspaper,
    title: "Market Insights",
    href: "/insights",
    body: "News summaries and educational guides on prices, central banks, and the macro picture — each tied to a cited, reputable source.",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Data first, opinions second",
    body: "Hard numbers — spot prices, changes, levels — come from real market data, not from a model's guess. Analysis is layered on top of that ground truth, never invented.",
  },
  {
    icon: BookOpen,
    title: "Cited and reviewed",
    body: "Insights link to reputable sources so you can check the claims yourself. Market calls are reviewed by a human before they publish — we don't auto-post financial recommendations.",
  },
  {
    icon: Compass,
    title: "Educational, not advisory",
    body: "GoldCompass helps you understand the gold market and make your own informed decisions. We are independent and do not sell gold, take commissions, or provide personalized financial advice.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={aboutPageSchema()} />

      <Container className="py-12 sm:py-16">
        {/* Intro */}
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm font-medium text-gold-strong">About {siteConfig.name}</p>
          <h1 className="text-3xl font-bold sm:text-4xl text-balance">
            Clear, trustworthy gold-investing guidance for everyone
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            Gold investing is full of noise — hype, jargon, and dealers with something to sell.
            GoldCompass exists to cut through it: plain-language outlooks, live data, and honest
            tools that help everyday investors understand the gold market and make their own
            informed decisions.
          </p>
        </div>

        {/* What we do */}
        <section aria-labelledby="what-we-do" className="mx-auto mt-16 max-w-4xl">
          <h2 id="what-we-do" className="text-2xl font-bold">
            What we do
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {whatWeDo.map(({ icon: Icon, title, href, body }) => (
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
        </section>

        {/* How we work / principles */}
        <section aria-labelledby="how-we-work" className="mx-auto mt-16 max-w-4xl">
          <h2 id="how-we-work" className="text-2xl font-bold">
            How we work
          </h2>
          <div className="mt-6 space-y-5">
            {principles.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5 text-gold-strong" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm text-pretty">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer callout */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              <strong>Important:</strong> GoldCompass provides educational information only — not
              financial, investment, tax, or legal advice. Always do your own research and consult
              a qualified professional before investing. Read our full{" "}
              <Link href="/disclaimer" className="font-medium underline underline-offset-4">
                disclaimer
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Subscribe CTA */}
        <section
          aria-labelledby="subscribe-heading"
          className="mx-auto mt-16 max-w-2xl rounded-2xl bg-foreground px-6 py-10 text-center text-background sm:px-12"
        >
          <h2 id="subscribe-heading" className="text-2xl font-bold">
            Get the weekly gold update
          </h2>
          <p className="text-background/80 mx-auto mt-2 max-w-md text-pretty">
            The latest outlook and market insights in your inbox. Free, and no spam — unsubscribe
            anytime.
          </p>
          <div className="mx-auto mt-6 max-w-md text-left">
            <SubscribeForm source="about" />
          </div>
          <p className="mt-6">
            <Button
              render={<Link href="/outlook" />}
              variant="outline"
              className="border-background/30 text-background hover:bg-background/10 hover:text-background bg-transparent"
            >
              Or explore the latest outlook
            </Button>
          </p>
        </section>
      </Container>
    </>
  );
}
