import { messages } from "@/i18n/messages";
import { RULES } from "@/server/outlook/signal";
import type { FactorKey, Horizon, Levels, StandingCall } from "@/types/signal";

import { STEPS, stepKey, type HorizonBrief } from "./brief";
import { levelText, type GenerationInput } from "./schema";

/** Bump when the prompt changes materially (shows up in logs / PR body). */
export const PROMPT_VERSION = "2026-11-19.1";

/**
 * The signal definitions are read from the UI catalog rather than restated, so
 * the model is always given the exact text a reader sees on `/methodology`.
 * The first prompt defined nothing, and the model filled the gap with advice
 * framing ("accumulate", "don't chase") — the opposite of what the page says a
 * signal is.
 */
const DEFINITIONS = messages("en").methodology.signals;

export const SYSTEM_PROMPT = `You are a seasoned gold-market analyst writing the daily outlook for GoldCompass, an educational gold-investing platform for everyday investors.

HOW THE CALL IS SET — READ THIS FIRST
You do NOT choose the BUY / HOLD / SELL signals. They are set by rules, from measured data:
1. A scorecard of measured factors produces a baseline signal for each horizon.
2. Each call is a STANDING call with price levels that were fixed on the day it opened. If a daily close has broken a level, the call is forced to move. You cannot argue that away.
3. You may request an ADJUSTMENT of one step (−1, 0 or +1) per horizon, and only for a specific, dated, sourced EVENT that the scorecard cannot yet see — a central-bank decision, a data release, a geopolitical development. Each data block below lists exactly which call each permitted step would publish.

Rules for adjustments:
- The default is 0. Most days it should be 0. The scorecard already reflects everything that has shown up in prices, the dollar and yields.
- A non-zero step must cite at least one item from your "drivers" list that (a) points the same way (bullish for +1, bearish for −1), (b) applies to that horizon, and (c) has an eventDate within the last ${RULES.adjustmentRecencyDays.short} days for the short term or ${RULES.adjustmentRecencyDays.long} days for the long term.
- A standing condition is NOT an event. "Central banks keep buying", "structural demand is intact" and "gold is a long-term diversifier" are true every day and therefore justify nothing. If you cannot name a dated event, the step is 0.
- Do not request a step listed as having no effect.

WHAT A SIGNAL MEANS
A signal describes market conditions over its horizon. It is not advice, and you must not write it as advice.
- BUY: ${DEFINITIONS.buy.body}
- HOLD: ${DEFINITIONS.hold.body}
- SELL: ${DEFINITIONS.sell.body}
In the summary and in each call's reason, describe conditions: what is supportive, what is adverse, and which dominates. Never tell the reader what to do — no "accumulate", "dollar-cost average", "scale in", "buy the dip", "don't chase", "falling knife", "take profits", "better entry", "stay on the sidelines".

GROUND TRUTH
Every number in the data blocks is authoritative. Do not contradict, re-estimate, or replace any of them with your own recollection — your memory of where gold "should" be is out of date. In particular:
- The ONE-YEAR CONTEXT block tells you where the price sits in its own history. Never describe the current price as a record, an all-time high, or "record territory" unless that block says spot is at the 52-week high. When you mention the high, state how far below it spot is.
- Do not describe a macro indicator as rising or falling unless the supplied change says so.
- "Higher than N% of readings in the past year" describes the past YEAR only. Say "near a one-year high", never "record" or "near-record", for the dollar or for yields.
- The dollar index supplied is the Federal Reserve's trade-weighted BROAD dollar index. It is NOT the ICE "DXY" and must not be called DXY. Call it the broad dollar index, or just "the dollar".
- If a block is marked unavailable, do not invent its figures.

RESEARCH
Use the web_search tool to find what is moving gold now: central-bank policy and commentary, inflation and jobs data, geopolitics, ETF and official-sector flows. Prefer primary and reputable sources. Record what you find as "drivers": dated events, each with the direction it pushes gold, the horizon it bears on, and the URL you read it at. The eventDate is the day the event happened or was reported, not today. Upcoming scheduled events may be listed with their future date, but cannot justify an adjustment.

STYLE
Trustworthy, clear, educational. Accessible to non-experts. No hype, no guarantees, no "as an AI" meta-commentary, and no disclaimer text (the site adds its own).
Write every number as digits, never as a word: "30-day", "20-day", "10-year", "1–4 weeks", "3 months" — not "thirty-day", "Twenty-day", "ten-year", "three months". The analysis is translated, and the translation is checked digit for digit against this text.

OUTPUT FORMAT — CRITICAL
After researching, respond with EXACTLY ONE JSON object and nothing else (no prose before or after, no code fences):

{
  "summary": string,                 // one paragraph, <= ~80 words: conditions now, and both calls
  "drivers": [                       // 2–6 dated events, most important first
    {
      "title": string,               // <= ~12 words
      "direction": "bullish" | "bearish" | "neutral",   // for the gold price
      "horizon": "short" | "long" | "both",
      "eventDate": "YYYY-MM-DD",
      "summary": string,             // 1–2 sentences: what happened and why it matters for gold
      "url": string                  // the source you read
    }
  ],
  "adjustments": {
    "short": { "step": -1 | 0 | 1, "reason": string, "driverIndexes": number[] },
    "long":  { "step": -1 | 0 | 1, "reason": string, "driverIndexes": number[] }
  },                                 // step 0: reason "" and driverIndexes []
  "calls": [                         // exactly 2: short, then long
    {
      "term": "short" | "long",
      "signal": "BUY" | "HOLD" | "SELL",   // MUST be the call listed for the step you requested
      "reason": string,              // 2–3 sentences on conditions, consistent with the scorecard
      "invalidation": string         // what would change this view; MUST quote the call's level(s) exactly as given, e.g. "$3,862"
    }
  ],
  "analysisMarkdown": string,        // 600–1200 words of Markdown. ## headings, lists, **bold**. NO raw HTML.
  "sources": [ { "title": string, "url": string } ]   // every source you relied on
}

The "analysisMarkdown" should cover: where the price sits in its one-year context, the scorecard reading for each horizon in plain language, the events driving the market, the short- and long-term outlooks, and the risks to each. Use Markdown only — never HTML tags.`;

/* -------------------------------------------------------------------------- */
/* User prompt                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The page's own labels, so the analysis names each factor the way the
 * scorecard panel beside it does. The stretch factor gets a hint here only:
 * without it the model reads "stretch" as supportive.
 */
const PAGE_LABELS = messages("en").outlook.scorecard.factors;
const FACTOR_LABELS: Record<FactorKey, string> = {
  ...PAGE_LABELS,
  stretch50d: `${PAGE_LABELS.stretch50d} (contrarian: counts against a price that has run far)`,
};

const HORIZON_NAME: Record<Horizon, string> = {
  short: "SHORT-TERM (next 1–4 weeks)",
  long: "LONG-TERM (next 3–12 months)",
};

const signed = (n: number, digits = 2): string => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
const pct = (n: number | null, digits = 1): string => (n == null ? "unavailable" : `${signed(n, digits)}%`);

const READING: Record<string, string> = {
  "2": "strongly supportive (+2)",
  "1": "supportive (+1)",
  "0": "neutral (0)",
  "-1": "adverse (−1)",
  "-2": "strongly adverse (−2)",
};

function levelsText(levels: Levels): string {
  const parts = [
    levels.below !== undefined ? `a daily close below ${levelText(levels.below)}` : null,
    levels.above !== undefined ? `a daily close above ${levelText(levels.above)}` : null,
  ].filter(Boolean);
  return parts.join(", or ");
}

function standingText(brief: HorizonBrief, standing: StandingCall | null): string {
  if (standing) {
    return (
      `${standing.signal} since ${standing.since}. Its levels, fixed on ${standing.levels.setOn}: ` +
      `broken by ${levelsText(standing.levels)}.`
    );
  }
  if (brief.legacySignal) {
    return `${brief.legacySignal} was published yesterday under the previous method (chosen freely, not by rules). Today's call is the first set by the scorecard; it carries no obligation to match.`;
  }
  return "None — this is the first call.";
}

function horizonBlock(brief: HorizonBrief): string[] {
  const lines: string[] = ["", `━━ ${HORIZON_NAME[brief.horizon]} ━━`, "Scorecard (measured; you cannot change these readings):"];

  for (const f of brief.scorecard.factors) {
    const value =
      f.value == null ? "unavailable" : `${signed(f.value)}${f.unit === "pp" ? " pp" : "%"}`;
    lines.push(`- ${FACTOR_LABELS[f.key]}: ${value} → ${f.value == null ? "not measured (0)" : READING[String(f.reading)]}`);
  }
  const neutral = brief.outcomes["0"].call;
  lines.push(
    `Score ${signed(brief.scorecard.score, 0)} → baseline ${neutral.baseline}.`,
    `Standing call: ${standingText(brief, brief.standing)}`,
  );

  if (brief.breach) {
    lines.push(
      `LEVEL BROKEN: the daily close of ${levelText(brief.breach.close)} on ${brief.breach.date} went ` +
        `${brief.breach.side} the level ${levelText(brief.breach.level)}. The call is forced to move; an adjustment cannot reverse that.`,
    );
  }

  lines.push("What each adjustment would publish:");
  for (const step of STEPS) {
    const { call } = brief.outcomes[stepKey(step)];
    const label = step === 0 ? " 0 (default)" : step > 0 ? "+1" : "−1";
    if (step !== 0 && !brief.effectiveSteps.includes(step)) {
      lines.push(`- step ${label}: no effect today — do not request it.`);
      continue;
    }
    lines.push(
      `- step ${label}: ${call.signal}, ${call.confidence} confidence. Its level(s): broken by ${levelsText(call.levels)}.`,
    );
  }
  return lines;
}

export function buildUserPrompt(input: GenerationInput): string {
  const { date, spot, state } = input;
  const lines: string[] = [
    `Produce the GoldCompass gold-market outlook for ${date}.`,
    "",
    "PRICE (ground truth):",
    `- Spot (XAU/USD): $${spot.price.toFixed(2)} per oz, as of ${spot.asOf}`,
    `- 24h change: ${spot.changePct24h == null ? "unknown" : pct(spot.changePct24h, 2)}`,
    "",
    `ONE-YEAR CONTEXT (ground truth, from ${state.historyDays} daily closes through ${state.asOf}):`,
    state.drawdownPct > -0.05
      ? `- Spot IS the 52-week high.`
      : `- 52-week high: ${levelText(state.high52w.price)} on ${state.high52w.date}. Spot is ${Math.abs(state.drawdownPct).toFixed(1)}% BELOW it.`,
    `- 52-week low: ${levelText(state.low52w.price)} on ${state.low52w.date}.`,
    `- 50-day average: ${state.ma50 == null ? "unavailable" : `${levelText(state.ma50)} (spot ${pct(state.pctVsMa50)} vs it)`}`,
    `- 200-day average: ${state.ma200 == null ? "unavailable" : `${levelText(state.ma200)} (spot ${pct(state.pctVsMa200)} vs it)`}`,
    `- Returns: 20-day ${pct(state.ret20d)}, 90-day ${pct(state.ret90d)}, one-year ${pct(state.ret365d)}`,
    state.low20d != null && state.high20d != null
      ? `- 20-day closing range: ${levelText(state.low20d)} to ${levelText(state.high20d)}`
      : "- 20-day closing range: unavailable",
    `- 20-day volatility (annualised): ${state.vol20dPct == null ? "unavailable" : `${state.vol20dPct.toFixed(0)}%`}`,
  ];

  if (input.macro && input.macro.indicators.length > 0) {
    lines.push("", "MACRO BACKDROP (ground truth):");
    for (const ind of input.macro.indicators) {
      const unit = ind.unit === "percent" ? "%" : "";
      const change = (value: number | null | undefined, window: string) =>
        value == null ? null : `${signed(value)}${ind.unit === "percent" ? " pp" : ""} over ${window}`;
      const details = [
        change(ind.change30d, "30 days"),
        change(ind.change90d, "90 days"),
        ind.pctile1y == null ? null : `higher than ${ind.pctile1y}% of readings in the past year`,
        `as of ${ind.asOf}`,
      ].filter(Boolean);
      lines.push(`- ${ind.label}: ${ind.value.toFixed(2)}${unit} (${details.join("; ")})`);
    }
    lines.push(`- ${input.macro.source}`);
  } else {
    lines.push(
      "",
      "MACRO BACKDROP: unavailable. The yield and dollar factors below are unmeasured; if you discuss them, research the figures and cite the source.",
    );
  }

  lines.push(...horizonBlock(input.briefs.short), ...horizonBlock(input.briefs.long));

  lines.push(
    "",
    "Research today's events with web_search, then respond with ONLY the JSON object specified in your instructions.",
  );
  return lines.join("\n");
}
