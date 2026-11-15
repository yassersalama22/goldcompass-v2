import { z } from "zod";

import { RULES, type MarketState } from "@/server/outlook/signal";
import type { MacroSnapshot } from "@/types/macro";
import { sourceSchema } from "@/types/outlook";
import {
  adjustmentStepSchema,
  driverSchema,
  horizonSchema,
  signalSchema,
  type Horizon,
} from "@/types/signal";

import { stepKey, type HorizonBrief } from "./brief";

/**
 * What the model produces — and, just as deliberately, what it does not.
 *
 * It writes prose, lists the dated events it found, and may request a one-step
 * adjustment per horizon. It does NOT supply the signal's value (it states one,
 * which is checked against the rules), nor confidence, levels, key levels,
 * prices or dates of record: the pipeline computes all of those.
 */

/** Deterministic data fed to the model as authoritative ground truth. */
export type GenerationInput = {
  /** ISO date the outlook is for. */
  date: string;
  spot: {
    price: number;
    changePct24h: number | null;
    asOf: string;
  };
  /** One year of price facts + macro readings as of today. */
  state: MarketState;
  /** Macro backdrop as published in the artifact. Null when unavailable. */
  macro: MacroSnapshot | null;
  briefs: Record<Horizon, HorizonBrief>;
};

const generatedCallSchema = z.object({
  term: horizonSchema,
  /** Must equal the call the rules give for the requested adjustment. */
  signal: signalSchema,
  reason: z.string().min(1).max(800),
  invalidation: z.string().min(1).max(600),
});

const adjustmentRequestSchema = z.object({
  step: adjustmentStepSchema,
  // Models write "", null or omit these when the step is 0 — all fine.
  reason: z.string().max(600).nullish(),
  driverIndexes: z.array(z.number().int().nonnegative()).nullish(),
});

const generatedOutlookBaseSchema = z.object({
  summary: z.string().min(1).max(600),
  drivers: z.array(driverSchema).min(2).max(6),
  adjustments: z.object({
    short: adjustmentRequestSchema,
    long: adjustmentRequestSchema,
  }),
  calls: z.array(generatedCallSchema).length(2),
  analysisMarkdown: z.string().min(1),
  sources: z.array(sourceSchema).max(12),
});
export type GeneratedOutlook = z.infer<typeof generatedOutlookBaseSchema>;

/** `$3,862` — how a level must appear in prose, and how the prompt states it. */
export const levelText = (value: number): string =>
  `$${Math.round(value).toLocaleString("en-US")}`;

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/* -------------------------------------------------------------------------- */
/* Lints                                                                       */
/* -------------------------------------------------------------------------- */

/** Below this drawdown, "record" is simply false about the current price. */
const RECORD_CLAIM_DRAWDOWN_PCT = -3;

/** A phrase that places something at or near a record. */
const RECORD_CLAIM =
  /\b(?:fresh|new)\s+(?:all[- ]time\s+)?(?:record|high)s?\b|\b(?:at|near|nearing|approaching|just\s+below|close\s+to|within\s+reach\s+of|printing|hitting|setting)\s+(?:a\s+|an\s+|its\s+|the\s+|new\s+|fresh\s+)*(?:record|all[- ]time)|\b(?:record|uncharted)\s+territory\b/gi;

/** …excused when the words around it show it is not about the price of gold, */
const RECORD_NOT_ABOUT_PRICE =
  /\b(?:ETFs?|holdings|inflows?|outflows?|tonn(?:e|es|age)|central[- ]bank|purchas\w+|buying|reserves|demand|debt|deficit|yields?|dollar|equit\w+|stocks?)\b/i;

/**
 * …or that it states the distance from the record, is about the past, or is a
 * denial. The last group is there because the first live run wrote "This is
 * the opposite of record territory" — correct, and flagged.
 */
const RECORD_DISTANCED =
  /\d+(?:\.\d+)?\s?%\s+(?:below|off|under|from|beneath)|\b(?:well|far|sharply|still)\s+(?:below|off|under)\b|\b(?:down|off|below|under|back|away|retreat\w*|fall\w*|fell|fallen|slid\w*|slipp\w*|drop\w*|pull\w*)\s+(?:\w+\s+)?from\b|\b(?:earlier|previous(?:ly)?|prior|ago|since|after)\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d|\b(?:in|of|early|late|mid)[- ]20\d\d\b|\b(?:opposite\s+of|not|no\s+longer|never|far\s+from|nowhere\s+near|rather\s+than|unlike|anything\s+but)\b|n't\b/i;

/** How much of the sentence around a claim is read to excuse it. */
const CLAIM_CONTEXT = 60;

/**
 * Sentences claiming the current price is at or near a record when the data
 * says otherwise. Narrow on purpose: this exists because roughly a third of the
 * outlooks published before the scorecard said exactly that, with the price
 * 20–30% under its high — not to police every use of the word "record".
 *
 * ADVISORY, not a rule. A pattern over prose cannot tell a claim from its
 * denial reliably enough to be allowed to fail a run: see `advisoriesFor`.
 *
 * A claim is excused only by words NEAR it. Testing the whole sentence let
 * "real yields are high, yet gold is still trading near record territory"
 * through, because the sentence happens to mention yields.
 */
export function recordClaims(text: string, state: MarketState): string[] {
  if (state.drawdownPct >= RECORD_CLAIM_DRAWDOWN_PCT) return [];
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) =>
      [...sentence.matchAll(RECORD_CLAIM)].some((match) => {
        const start = Math.max(0, match.index - CLAIM_CONTEXT);
        const around = sentence.slice(start, match.index + match[0].length + CLAIM_CONTEXT);
        return !RECORD_NOT_ABOUT_PRICE.test(around) && !RECORD_DISTANCED.test(around);
      }),
    );
}

/**
 * Advice framing. A signal describes market conditions (`/methodology`); it is
 * not an instruction. This vocabulary is how the old calls became constant:
 * "accumulate gradually" is true in every market, so long-term was always BUY,
 * and "don't chase" / "don't catch a falling knife" turned both rallies and
 * sell-offs into HOLD.
 */
const ADVICE =
  /\baccumulat\w*|\bdollar[- ]cost\w*|\bDCA\b|\bchas(?:e|es|ed|ing)\b|\bfalling\s+knife\b|\bscal(?:e|ing)\s+in\b|\bbuy(?:ing)?\s+the\s+dip\b|\btak(?:e|ing)\s+profits?\b|\b(?:better|good|attractive)\s+entry\b|\bstay\s+on\s+the\s+sidelines\b/gi;

/**
 * "Central banks keep accumulating" describes what a buyer is doing; it is not
 * advice to the reader. Only `accumulat…` needs this — the other phrases have
 * no descriptive use in a gold outlook.
 */
const INSTITUTIONAL_SUBJECT =
  /\b(?:central[- ]banks?|official(?:[- ]sector)?|reserve\s+managers?|sovereign\w*|institutions?|ETFs?|funds?|PBoC|RBI)\b/i;

/** The first advice phrase in `text`, or null. Advisory — see `advisoriesFor`. */
export function adviceFraming(text: string): string | null {
  for (const match of text.matchAll(ADVICE)) {
    if (/^accumulat/i.test(match[0])) {
      const before = text.slice(Math.max(0, match.index - CLAIM_CONTEXT), match.index);
      if (INSTITUTIONAL_SUBJECT.test(before)) continue;
    }
    return match[0];
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Validation against the brief                                                */
/* -------------------------------------------------------------------------- */

export type GeneratedIssue = { path: (string | number)[]; message: string };

/**
 * Everything about a generated outlook that depends on today's data. Returned
 * as plain issues (and wrapped in a schema below) so the fixtures can assert on
 * the reasons, and so each message can tell the model how to fix it — these
 * strings are fed straight back to it on the one corrective retry.
 */
export function validateGenerated(g: GeneratedOutlook, input: GenerationInput): GeneratedIssue[] {
  const issues: GeneratedIssue[] = [];

  for (const horizon of ["short", "long"] as const) {
    const brief = input.briefs[horizon];
    const request = g.adjustments[horizon];
    const callIndex = g.calls.findIndex((c) => c.term === horizon);
    const call = g.calls[callIndex];
    if (!call) {
      issues.push({ path: ["calls"], message: `Missing the ${horizon}-term call.` });
      continue;
    }

    if (request.step !== 0) {
      const path = ["adjustments", horizon];
      if (!brief.effectiveSteps.includes(request.step)) {
        issues.push({
          path,
          message:
            `A ${request.step > 0 ? "+1" : "-1"} adjustment has no effect on the ${horizon}-term call today ` +
            `(the call is fixed by a breached level, or is already at that end of the scale). Set step to 0.`,
        });
      }
      if (!request.reason?.trim()) {
        issues.push({ path, message: "A non-zero adjustment needs a reason." });
      }

      const cited = (request.driverIndexes ?? []).map((i) => g.drivers[i]);
      const window = RULES.adjustmentRecencyDays[horizon];
      const wanted = request.step > 0 ? "bullish" : "bearish";
      if (cited.length === 0 || cited.some((d) => d === undefined)) {
        issues.push({
          path,
          message: "A non-zero adjustment must cite at least one driver by a valid index into `drivers`.",
        });
      } else if (
        !cited.some((d) => {
          const age = daysBetween(d!.eventDate, input.date);
          return (
            d!.direction === wanted &&
            (d!.horizon === horizon || d!.horizon === "both") &&
            age >= 0 &&
            age <= window
          );
        })
      ) {
        issues.push({
          path,
          message:
            `A ${request.step > 0 ? "+1" : "-1"} ${horizon}-term adjustment must cite a ${wanted} driver that applies to ` +
            `the ${horizon} term and whose eventDate is within the last ${window} days (on or before ${input.date}). ` +
            `A standing condition without a recent dated event does not justify an adjustment — set step to 0.`,
        });
      }
    }

    const outcome = brief.outcomes[stepKey(request.step)].call;
    if (call.signal !== outcome.signal) {
      issues.push({
        path: ["calls", callIndex, "signal"],
        message:
          `With a ${horizon}-term adjustment of ${request.step}, the rules give ${outcome.signal}, not ${call.signal}. ` +
          `State ${outcome.signal} and write the reason for ${outcome.signal}, or change the adjustment.`,
      });
    }

    // The prose and the frozen numbers must not be able to disagree.
    for (const level of [outcome.levels.below, outcome.levels.above]) {
      if (level !== undefined && !call.invalidation.includes(levelText(level))) {
        issues.push({
          path: ["calls", callIndex, "invalidation"],
          message: `The ${horizon}-term invalidation must state the level ${levelText(level)} exactly as written.`,
        });
      }
    }

  }

  return issues;
}

/**
 * Prose advisories — things worth one corrective pass and a reviewer's eye,
 * but never worth failing a run over.
 *
 * These were hard rules for exactly one live run. The model wrote "This is the
 * opposite of record territory — it is the weakest the metal has been in a
 * year", which is correct; the pattern saw "record territory", rejected it
 * twice, and the day's outlook was lost. `validateGenerated` holds the rules
 * that are mechanically decidable (a signal either equals the rules' or it does
 * not). Whether a sentence *means* something is a judgement, so here it gets
 * the judgement's treatment: the model is asked once to revise, and whatever
 * remains is put in front of the human who reviews the PR.
 */
export function advisoriesFor(g: GeneratedOutlook, input: GenerationInput): string[] {
  const notes: string[] = [];

  const framed: [string, string][] = [
    ["summary", g.summary],
    ...g.calls.map((c): [string, string] => [`${c.term}-term reason`, c.reason]),
  ];
  for (const [where, text] of framed) {
    const advice = adviceFraming(text);
    if (advice) {
      notes.push(
        `${where}: "${advice}" reads as advice. Describe the market conditions over the horizon — ` +
          `what is supportive, what is adverse — not what a reader should do.`,
      );
    }
  }

  const prose: [string, string][] = [
    ["summary", g.summary],
    ["analysis", g.analysisMarkdown],
    ...g.calls.map((c): [string, string] => [`${c.term}-term reason`, c.reason]),
  ];
  for (const [where, text] of prose) {
    for (const sentence of recordClaims(text, input.state)) {
      notes.push(
        `${where}: this may describe the price as at or near a record, but spot is ` +
          `${Math.abs(input.state.drawdownPct).toFixed(1)}% below the 52-week high of ` +
          `${levelText(input.state.high52w.price)} (${input.state.high52w.date}): "${sentence.slice(0, 200)}"`,
      );
    }
  }

  return notes;
}

/**
 * The schema for one run: the static shape, plus every rule that depends on
 * today's brief. Built per run so the shared retry path in
 * `src/server/llm/grounded-json.ts` enforces all of it without knowing any of it.
 */
export function buildGeneratedSchema(input: GenerationInput): z.ZodType<GeneratedOutlook> {
  return generatedOutlookBaseSchema.superRefine((g, ctx) => {
    for (const issue of validateGenerated(g, input)) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
  });
}
