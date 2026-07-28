import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  Bot,
  UserCheck,
  RefreshCw,
  Scale,
  TriangleAlert,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { methodologyPageSchema } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How GoldCompass produces its gold-market outlook: where the price data comes from, how the analysis is drafted and human-reviewed before publishing, what the signals mean, and the limitations you should know about.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: `Methodology — how ${siteConfig.name} works`,
    description:
      "Our data sources, our generation and review process, what the signals mean, and where our limits are.",
    url: "/methodology",
    type: "website",
  },
};

/** Meaning of each published signal — kept in sync with `signalSchema`. */
const signals = [
  {
    term: "BUY",
    body: "Conditions over the stated horizon look more supportive than not for gold. It is not an instruction to buy, and it says nothing about your circumstances, timing, or risk tolerance.",
  },
  {
    term: "HOLD",
    body: "No clear directional edge over the horizon — drivers are mixed or offsetting. Often the most honest reading of a market, and the least interesting to report.",
  },
  {
    term: "SELL",
    body: "Conditions over the stated horizon look more challenging than supportive for gold. Again, a description of the setup, not a recommendation to sell anything you own.",
  },
];

const confidence = [
  {
    term: "High",
    body: "The main drivers point the same way and the supporting data is consistent.",
  },
  {
    term: "Medium",
    body: "The view is reasonably supported, but at least one significant driver cuts the other way.",
  },
  {
    term: "Low",
    body: "The balance of evidence is genuinely unclear, or the situation is moving quickly. Treat these as weakly held.",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <JsonLd data={methodologyPageSchema()} />

      <Container className="py-12 sm:py-16">
        {/* Intro */}
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm font-medium text-gold-strong">Methodology</p>
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">
            How we produce our gold outlook
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            We publish directional calls on the gold market, so you are entitled to know exactly
            how they are made — what data goes in, what role automation plays, who checks the
            output, and where the whole thing falls short. This page is the honest answer to all
            four.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-16">
          {/* Data sources */}
          <section aria-labelledby="data" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Database className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="data" className="text-2xl font-bold">
                Where the numbers come from
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                Every hard number we display — the spot price, the daily change, the 30-day chart
                on our{" "}
                <Link href="/trends" className="text-gold-strong underline underline-offset-4">
                  trends page
                </Link>{" "}
                — is fetched from a market data source. None of it is produced by a language
                model. This separation is deliberate and is the single most important thing on
                this page: models are useful for explaining a market and unreliable for quoting
                it, so we never ask one to supply a price.
              </p>
              <p>
                Our current price source is the CoinGecko public API, which we read via{" "}
                <strong className="text-foreground">PAX Gold (PAXG)</strong> — a token backed
                one-to-one by physical gold — as our proxy for the XAU/USD spot price. You should
                know what that implies:{" "}
                <strong className="text-foreground">
                  PAXG tracks the gold price closely but is not the London benchmark fix
                </strong>
                , and it can deviate modestly, particularly during thin trading. Our figures are
                appropriate for orientation and education; they are not suitable as a settlement
                or valuation price, and you should confirm against your dealer&rsquo;s own quote
                before transacting.
              </p>
              <p>
                The spot quote refreshes roughly every 5 minutes and the 30-day series roughly
                hourly. Each page shows when its data was last updated. If the upstream source is
                unavailable we show the last known good reading and label it, rather than
                displaying a blank or a stale number silently.
              </p>
            </div>
          </section>

          {/* Generation */}
          <section aria-labelledby="generation" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Bot className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="generation" className="text-2xl font-bold">
                How the analysis is written
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                <strong className="text-foreground">
                  The written analysis is drafted by an AI system and reviewed by a human before
                  it is published.
                </strong>{" "}
                We state this plainly because you should be able to weigh it. Concretely, each
                outlook goes through these steps:
              </p>
              <ol className="ml-1 space-y-3">
                {[
                  "Market data is fetched first, from the source described above, and passed into the drafting step as fixed ground truth the model is not permitted to alter.",
                  "A large language model (Anthropic's Claude) drafts the analysis on top of that data. It has web search available so it can take account of recent, relevant market news, and it is required to cite the sources it relies on.",
                  "The draft is validated against a strict schema. Anything missing a required field — a signal, a rationale, a source — is rejected outright rather than published in part.",
                  "The result is opened as a change for review. A human reads it and decides whether it publishes. Nothing reaches the site automatically.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="bg-accent text-gold-strong mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p>
                Every published outlook lists the sources behind it. We encourage you to follow
                them — an analysis you can check is worth more than one you have to trust.
              </p>
              <p>
                Our{" "}
                <Link href="/insights" className="text-gold-strong underline underline-offset-4">
                  insights articles
                </Link>{" "}
                are produced the same way, with one difference: they are not on a schedule. Each
                topic is chosen deliberately by a person in response to what is actually happening
                in the market, then drafted, cited, reviewed, and published through the same
                pipeline.
              </p>
            </div>
          </section>

          {/* Human review */}
          <section aria-labelledby="review" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <UserCheck className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="review" className="text-2xl font-bold">
                What the human review actually checks
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                &ldquo;Human reviewed&rdquo; is a claim worth being specific about, because it is
                often used loosely. In our case the reviewer checks that the quoted figures match
                the fetched market data, that the cited sources exist and genuinely support the
                claims made, that the reasoning is internally consistent with the signal, and that
                the tone stays educational rather than promotional or alarmist. Anything that
                fails is corrected or discarded.
              </p>
              <p>
                What that review is{" "}
                <strong className="text-foreground">not</strong> is a guarantee of accuracy. It is
                a competent editorial check on a piece of market commentary, not a professional
                audit, and it cannot make an uncertain forecast certain.
              </p>
            </div>
          </section>

          {/* Signal meanings */}
          <section aria-labelledby="signals" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Scale className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="signals" className="text-2xl font-bold">
                What the signals mean
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                Each outlook carries two calls — a short-term and a long-term view — because they
                frequently disagree, and that disagreement is information rather than a
                contradiction. A market can be stretched over weeks while remaining well supported
                over years.
              </p>
            </div>

            <dl className="divide-border divide-y rounded-xl border">
              {signals.map(({ term, body }) => (
                <div key={term} className="grid gap-1 p-4 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-muted-foreground text-sm text-pretty">{body}</dd>
                </div>
              ))}
            </dl>

            <h3 className="pt-2 font-semibold">Confidence</h3>
            <p className="text-muted-foreground text-pretty">
              Every call carries a confidence level, which describes how strong the supporting
              evidence is — not how likely the outcome is.
            </p>
            <dl className="divide-border divide-y rounded-xl border">
              {confidence.map(({ term, body }) => (
                <div key={term} className="grid gap-1 p-4 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-muted-foreground text-sm text-pretty">{body}</dd>
                </div>
              ))}
            </dl>

            <h3 className="pt-2 font-semibold">Invalidation</h3>
            <p className="text-muted-foreground text-pretty">
              Where we can state one, we publish the condition that would break the view — a price
              level or event that, if it occurs, means the reasoning was wrong. We consider this
              the most useful part of any market call, and the part most commentary omits. A view
              that cannot be wrong cannot be assessed.
            </p>
          </section>

          {/* Cadence */}
          <section aria-labelledby="cadence" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <RefreshCw className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="cadence" className="text-2xl font-bold">
                How often it updates
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                The outlook is regenerated daily, and both the short- and long-term calls are
                reconsidered each time. In practice the long-term view changes far less often than
                the short-term one — that is expected, and a stable long-term call is a feature
                rather than a stale page.
              </p>
              <p>
                The publication date on{" "}
                <Link href="/outlook" className="text-gold-strong underline underline-offset-4">
                  the outlook
                </Link>{" "}
                always reflects the view actually shown. If a day&rsquo;s draft fails validation
                or review, we keep the previous published outlook and its original date rather
                than publishing something unchecked.
              </p>
            </div>
          </section>

          {/* Calculator */}
          <section aria-labelledby="calculator" className="space-y-4">
            <h2 id="calculator" className="text-2xl font-bold">
              The calculator&rsquo;s math
            </h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                Our{" "}
                <Link
                  href="/calculator"
                  className="text-gold-strong underline underline-offset-4"
                >
                  gold calculator
                </Link>{" "}
                is deterministic arithmetic that runs in your browser — no model is involved and
                nothing you enter is sent to us. Quantity is your budget divided by the dealer
                price per ounce, where that price is the spot price multiplied by the metal&rsquo;s
                purity and then by one plus your dealer premium.
              </p>
              <p>
                Break-even is the spot price multiplied by one plus the premium. Purity cancels
                out of that calculation, which is why the percentage rise you need to break even
                is the same for 24K and 14K: you pay the premium either way. The figures exclude
                storage, insurance, taxes, shipping, and any sell-side commission, all of which
                are real costs that will worsen your actual outcome.
              </p>
            </div>
          </section>

          {/* Limitations */}
          <section aria-labelledby="limits" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <TriangleAlert className="size-5 text-gold-strong" aria-hidden="true" />
              </div>
              <h2 id="limits" className="text-2xl font-bold">
                Limitations, and what we don&rsquo;t do
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                Nobody can forecast the gold price, and we are not claiming to. What we publish is
                a reasoned reading of current conditions, which will sometimes be wrong. Beyond
                that general caveat, these specific limits apply: our spot price is a proxy rather
                than the benchmark fix; AI-drafted analysis can misread a situation in ways review
                does not always catch; our sources are public reporting, so we inherit their
                errors and lag; and market conditions can change materially between our last
                update and the moment you read it.
              </p>
              <p>
                We are independent. We do not sell gold, we take no commissions or dealer
                referrals, and no third party pays for or influences a call. We also do not
                provide personalized advice — we cannot see your finances, your tax position, or
                your goals, and nothing here is tailored to them.
              </p>
              <p>
                If you spot an error, we would genuinely like to know. Corrections are made to the
                published page and the update timestamp reflects the change.
              </p>
            </div>
          </section>

          {/* Disclaimer callout */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              <strong>Important:</strong> Everything on GoldCompass is educational information
              only — not financial, investment, tax, or legal advice. Gold can lose value, and
              past performance tells you nothing reliable about future results. Always do your own
              research and consult a qualified professional before investing. Read our full{" "}
              <Link href="/disclaimer" className="font-medium underline underline-offset-4">
                disclaimer
              </Link>
              .
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
