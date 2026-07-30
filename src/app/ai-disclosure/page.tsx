import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Check, Database, ShieldCheck, TriangleAlert, UserCheck, X } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { aiDisclosurePageSchema } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "AI Disclosure",
  description:
    "Exactly where AI is used on GoldCompass and where it is not: how our analysis is drafted, what data the system is given, what it is never allowed to produce, how drafts are checked, and the failure modes we know about.",
  alternates: { canonical: "/ai-disclosure" },
  openGraph: {
    title: `AI Disclosure — ${siteConfig.name}`,
    description:
      "What our AI system writes, what it never touches, who checks it, and the limitations we know about.",
    url: "/ai-disclosure",
    type: "website",
  },
};

/** Shown in the page footer and in the JSON-LD `dateModified`. */
const LAST_UPDATED = "2026-07-30";

const aiWrites = [
  "The written analysis on the outlook page — the market narrative, the reasoning behind each call, and the risks section.",
  "The BUY / HOLD / SELL signals themselves, their confidence levels, and the invalidation conditions attached to them.",
  "The insight articles: the topic is chosen by a person, the draft is written by the model.",
  "The key-level labels that summarise support, resistance, and notable prices.",
];

const aiNeverTouches = [
  "The spot price, the daily change, every point on the 30-day chart, and the macro figures — the dollar index and Treasury yields. These come from market data feeds and are passed to the model as fixed inputs it is told not to contradict.",
  "Every figure the calculators produce. That is deterministic arithmetic running in your browser — no model is involved at any point.",
  "The source list under each piece. Those are the URLs the model reported using, published unedited so you can check them yourself.",
  "This page, the methodology page, the disclaimer, and the rest of the site's editorial copy.",
];

const failureModes = [
  {
    risk: "The model states something confidently that is wrong",
    mitigation:
      "Hard numbers are supplied to it rather than requested from it, and a reviewer checks the claims against the sources before anything publishes.",
    residual:
      "Review is an editorial check, not an audit. A plausible-sounding misreading of a genuine source can survive it.",
  },
  {
    risk: "A source is cited that does not support the claim",
    mitigation:
      "At least one source is required or the draft is rejected, and the reviewer follows the citations.",
    residual:
      "A source that is real and roughly on-topic but does not actually support the specific sentence is the hardest case to catch.",
  },
  {
    risk: "Web search returns low-quality or manipulated content",
    mitigation:
      "The prompt requires reputable sources, and any HTML is stripped from what the model returns before it is stored, so retrieved content cannot inject markup into our pages.",
    residual:
      "We cannot rule out a well-dressed but poor source shaping the framing of a piece.",
  },
  {
    risk: "The analysis reads as more certain than the evidence justifies",
    mitigation:
      "Every call carries an explicit confidence level and a stated condition that would invalidate it.",
    residual:
      "Fluent prose is persuasive regardless of whether it is right. Treat confidence as a description of the evidence, not a probability.",
  },
  {
    risk: "The market moves after publication",
    mitigation:
      "The outlook regenerates daily and every page shows when it was last updated.",
    residual: "Anything you read is a view as of its timestamp, not as of now.",
  },
  {
    risk: "The model produces a broken or incomplete draft",
    mitigation:
      "Drafts are validated against a strict schema. A draft missing a required field is rejected, retried once, and otherwise discarded — the previously published version stays up.",
    residual:
      "This one fails safe: the visible outcome is an older outlook, not a corrupted one.",
  },
];

const neverDo = [
  "Publish AI-drafted analysis without a person approving it.",
  "Let a model supply a price, a percentage, or any other hard number we display.",
  "Present AI-written text under a fabricated human byline or persona.",
  "Use AI to generate personalized advice — we cannot see your circumstances and do not try to.",
  "Send anything you type into this site to a language model.",
];

export default function AiDisclosurePage() {
  return (
    <>
      <JsonLd data={aiDisclosurePageSchema(LAST_UPDATED)} />

      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-gold-strong text-sm font-medium">AI disclosure</p>
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">
            Where we use AI, and where we deliberately don&rsquo;t
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            The market analysis on this site is drafted by an AI system and reviewed by a person
            before it is published. We put that at the top rather than in a footnote, because on a
            site about money the reader should get to decide how much that matters. This page sets
            out exactly which parts are AI-written, which parts a model never touches, and what can
            go wrong anyway.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-16">
          {/* Split: what AI writes vs what it never touches */}
          <section aria-labelledby="split" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Bot className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="split" className="text-2xl font-bold">
                The dividing line
              </h2>
            </div>
            <p className="text-muted-foreground text-pretty">
              The single most important design decision we made is that the model explains the
              market but never reports it. Retrieval and reasoning are kept apart: the numbers are
              fetched deterministically and handed to the model as ground truth, and the model
              writes analysis on top of them. A language model asked to recall a gold price will
              sometimes produce a plausible one, and a plausible price is worse than no price.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Bot className="text-gold-strong size-4" aria-hidden="true" />
                  AI drafts this
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {aiWrites.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-2 text-sm leading-6">
                      <Check className="text-gold-strong mt-1 size-3.5 shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Database className="text-gold-strong size-4" aria-hidden="true" />
                  AI never touches this
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {aiNeverTouches.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-2 text-sm leading-6">
                      <X className="text-gold-strong mt-1 size-3.5 shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* The system */}
          <section aria-labelledby="system" className="space-y-4">
            <h2 id="system" className="text-2xl font-bold">
              What the drafting system is
            </h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                The drafting is done by a general-purpose large language model from a commercial AI
                provider, accessed over its API. It is given a web-search tool so it can take
                account of recent market news, capped at a small number of searches per run, and it
                is required to return the sources it actually used.
              </p>
              <p>
                We describe it that way rather than naming a version deliberately. Which model we
                use is a configuration value we revisit as better ones become available, and a
                disclosure page naming last quarter&rsquo;s model would be less accurate than one
                describing what the system actually does. No other AI system is involved in
                producing what you read here, and we do not use AI-generated images.
              </p>
              <p>
                What does not change is the constraint around it. Whichever model is in use, it is
                handed the numbers rather than asked for them, it must cite the sources it relied
                on, its output must satisfy a strict schema, and a person approves the result before
                it publishes. Those guarantees belong to our process, not to any vendor&rsquo;s.
              </p>
            </div>
          </section>

          {/* Pipeline */}
          <section aria-labelledby="pipeline" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ShieldCheck className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="pipeline" className="text-2xl font-bold">
                What happens between the model and the page
              </h2>
            </div>
            <p className="text-muted-foreground text-pretty">
              Model output is not published as it arrives. Five things happen to it first, and any
              of them can stop it.
            </p>
            <ol className="ml-1 space-y-3">
              {[
                "Market data is fetched first and injected into the prompt as authoritative ground truth, with an instruction not to contradict or re-estimate it.",
                "The model researches and drafts, then must return a single structured object — not free-form prose — containing the analysis, the calls, the key levels, and its sources.",
                "That object is validated against a strict schema. A missing signal, a missing rationale, or an article with no sources is rejected. One corrective attempt is allowed; after that the draft is discarded and the previously published version stays live.",
                "HTML is stripped from the text before storage. We keep Markdown and render it through our own components, so nothing retrieved from the web can inject markup into a page.",
                "The result is opened as a proposed change for review. A person reads it and decides whether it publishes. Nothing reaches the site on its own.",
              ].map((step, i) => (
                <li key={i} className="text-muted-foreground flex gap-3 text-pretty">
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
          </section>

          {/* Human review */}
          <section aria-labelledby="review" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <UserCheck className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="review" className="text-2xl font-bold">
                What &ldquo;human reviewed&rdquo; means here
              </h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                The reviewer checks that the quoted figures match the fetched market data, that the
                cited sources exist and support the claims made, that the reasoning is consistent
                with the signal, and that the tone stays educational rather than promotional.
                Anything that fails is corrected or discarded.
              </p>
              <p>
                It is worth being equally clear about the limits of that. Review is a competent
                editorial check on market commentary — not a professional audit, not a verification
                of every underlying fact, and not something that can make an uncertain forecast
                certain. Our{" "}
                <Link
                  href="/methodology"
                  className="text-gold-strong underline underline-offset-4"
                >
                  methodology page
                </Link>{" "}
                covers the surrounding process in more detail: data sources, signal definitions,
                and update cadence.
              </p>
            </div>
          </section>

          {/* Your data */}
          <section aria-labelledby="privacy" className="space-y-4">
            <h2 id="privacy" className="text-2xl font-bold">
              Nothing you type goes to a model
            </h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>
                Content generation happens on a schedule, away from the site, and it takes no input
                from visitors. There is no chatbot here and no feature that forwards what you enter
                to an AI provider.
              </p>
              <p>
                The{" "}
                <Link href="/calculator" className="text-gold-strong underline underline-offset-4">
                  calculators
                </Link>{" "}
                run entirely in your browser — your budget, your holdings, and the figures you enter
                are never sent to us at all, which is also why a shared calculator link carries its
                inputs in the URL rather than on a server. The only thing you can submit is a
                newsletter email address, which goes to our email provider and nowhere near a
                language model.
              </p>
            </div>
          </section>

          {/* Failure modes */}
          <section aria-labelledby="limits" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <TriangleAlert className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="limits" className="text-2xl font-bold">
                What can still go wrong
              </h2>
            </div>
            <p className="text-muted-foreground text-pretty">
              Every mitigation below leaves something behind. Listing only the safeguards would be
              the dishonest version of this page, so each row states what remains after ours have
              done their work.
            </p>
            <div className="divide-border divide-y rounded-xl border">
              {failureModes.map((mode) => (
                <div key={mode.risk} className="space-y-2 p-5">
                  <h3 className="font-semibold">{mode.risk}</h3>
                  <p className="text-muted-foreground text-sm leading-6">
                    <span className="text-foreground font-medium">What we do: </span>
                    {mode.mitigation}
                  </p>
                  <p className="text-muted-foreground text-sm leading-6">
                    <span className="text-foreground font-medium">What remains: </span>
                    {mode.residual}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Never */}
          <section aria-labelledby="never" className="space-y-4">
            <h2 id="never" className="text-2xl font-bold">
              Things we will not do
            </h2>
            <ul className="space-y-2.5">
              {neverDo.map((item) => (
                <li key={item} className="text-muted-foreground flex gap-2 text-pretty">
                  <X className="text-gold-strong mt-1.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Disclaimer callout */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              <strong>Important:</strong> Everything on GoldCompass is educational information only
              — not financial, investment, tax, or legal advice. That an analysis was reviewed by a
              person does not make it advice, and does not make it right. Read our full{" "}
              <Link href="/disclaimer" className="font-medium underline underline-offset-4">
                disclaimer
              </Link>
              .
            </p>
          </div>

          <p className="text-muted-foreground border-t pt-6 text-sm">
            Last updated{" "}
            <time dateTime={LAST_UPDATED}>
              {new Date(LAST_UPDATED).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>
            . We will revise this page if the model, the pipeline, or the review process changes.
          </p>
        </div>
      </Container>
    </>
  );
}
