/**
 * Replay the signal rules over real history — `npm run outlook:replay`.
 *
 * Runs the exact code that sets the published call (market state → scorecard →
 * standing call), one day at a time, over the past year of prices and macro
 * data, with no AI adjustment. It answers the questions a threshold change has
 * to be judged against:
 *
 *   - Do the calls move when conditions move, or sit on one answer?
 *   - How often do they change? (Changing on noise is no better than never.)
 *   - What forced each change — the scorecard, or a breached level?
 *
 * It also prints what happened to the price after each call. Read that as a
 * health check, NOT a performance claim: these rules describe current
 * conditions, they are not shown to predict the weeks ahead, and one year is
 * one regime. Tuning thresholds until that table looks good would be fitting
 * noise.
 *
 * `--deep` replays ~1,000 days instead of 365. The production price source
 * serves one year on its free tier, and the 200-day average consumes 200 of
 * those, which left the long-term rules exercised in a single regime. Deep mode
 * reads daily closes of the same gold proxy (PAX Gold) from a public
 * market-data endpoint. It is a CALIBRATION source only: nothing from it is
 * ever published, stored, or shown to a reader.
 *
 * Network: one price request and (with FRED_API_KEY) three macro requests.
 * Scripts do not read `.env.local` —  `set -a; . ./.env.local; set +a` first.
 * Exits 1 if a horizon never leaves a single signal while its score ranges
 * across the thresholds, which would mean the rules had reproduced the old
 * failure.
 */
import { fetchMacroHistory } from "@/server/macro";
import { coinGeckoProvider } from "@/server/price/coingecko";
import {
  RULES,
  RULES_VERSION,
  buildMarketState,
  resolveCall,
  scoreFor,
  toDailyCloses,
  type DailyClose,
  type StandingCall,
} from "@/server/outlook/signal";
import type { MacroHistory } from "@/types/macro";
import type { Horizon, Scorecard, Signal } from "@/types/signal";

type Row = {
  date: string;
  price: number;
  call: StandingCall;
  card: Scorecard;
  changed: boolean;
};

const SIGNALS: Signal[] = ["BUY", "HOLD", "SELL"];
/** History each horizon needs before its trend factors can be measured. */
const WARMUP: Record<Horizon, number> = { short: 50, long: 200 };
/** Days ahead for the "what happened next" table. */
const FORWARD: Record<Horizon, number> = { short: 21, long: 60 };

const MAX_CHANGES_SHOWN = 30;
const DEEP = process.argv.includes("--deep");

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
const pad = (s: string | number, width: number) => String(s).padEnd(width);

function replay(
  horizon: Horizon,
  closes: DailyClose[],
  macro: MacroHistory | null,
  confirmDays: number = RULES.confirmDays,
): Row[] {
  const rows: Row[] = [];
  const scores: number[] = [];
  let previous: StandingCall | null = null;

  for (let i = WARMUP[horizon] - 1; i < closes.length; i++) {
    const today = closes[i]!;
    const state = buildMarketState({ closes: closes.slice(0, i + 1), macro });
    const card = scoreFor(horizon, state);
    const { call, changed } = resolveCall({
      horizon,
      previous,
      scorecard: card,
      state,
      newCloses: previous
        ? closes.filter((c) => c.date > previous!.lastChecked && c.date <= today.date)
        : [],
      // Most recent first — the readings a baseline move is confirmed against.
      priorScores: scores.slice(-(confirmDays - 1) || scores.length).reverse(),
      confirmDays,
      step: 0,
      today: today.date,
    });
    rows.push({ date: today.date, price: today.close, call, card, changed });
    scores.push(card.score);
    previous = call;
  }
  return rows;
}

/** How long each call stood, in days. */
function spellsOf(rows: Row[]): number[] {
  const spells: number[] = [];
  let run = 0;
  for (const r of rows) {
    if (r.changed && run > 0) {
      spells.push(run);
      run = 0;
    }
    run++;
  }
  spells.push(run);
  return spells.sort((a, b) => a - b);
}

function report(horizon: Horizon, rows: Row[], closes: DailyClose[]): boolean {
  const first = rows[0]!;
  const last = rows.at(-1)!;
  const months = rows.length / 30.4;
  const changes = rows.filter((r) => r.changed);

  console.log(`\n━━ ${horizon === "short" ? "SHORT-TERM (1–4 weeks)" : "LONG-TERM (3–12 months)"} ━━`);
  console.log(
    `${rows.length} days replayed, ${first.date} → ${last.date} ` +
      `(price ${usd(Math.min(...rows.map((r) => r.price)))}–${usd(Math.max(...rows.map((r) => r.price)))})`,
  );

  const counts = Object.fromEntries(
    SIGNALS.map((s) => [s, rows.filter((r) => r.call.signal === s).length]),
  ) as Record<Signal, number>;
  console.log(
    "Days at each signal:   " +
      SIGNALS.map((s) => `${s} ${counts[s]} (${Math.round((100 * counts[s]) / rows.length)}%)`).join("   "),
  );

  const confidence = ["high", "medium", "low"].map(
    (c) => `${c} ${rows.filter((r) => r.call.confidence === c).length}`,
  );
  console.log(`Days at each confidence: ${confidence.join("   ")}`);

  const scores = rows.map((r) => r.card.score);
  console.log(`Score range: ${Math.min(...scores)} … ${Math.max(...scores)}`);
  console.log(
    `Changes: ${changes.length} (${(changes.length / months).toFixed(1)} per month)   ` +
      Object.entries(
        changes.reduce<Record<string, number>>((acc, r) => {
          const reason = r.call.change?.reason ?? "?";
          acc[reason] = (acc[reason] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([reason, n]) => `${reason} ${n}`)
        .join(", "),
  );

  const sorted = spellsOf(rows);
  console.log(
    `Call duration (days): shortest ${sorted[0]}, median ${sorted[Math.floor(sorted.length / 2)]}, longest ${sorted.at(-1)}`,
  );

  console.log("\nEvery change:");
  console.log(`  ${pad("date", 11)}${pad("price", 8)}${pad("call", 14)}${pad("why", 20)}${pad("score", 6)}levels`);
  const shown = changes.length > MAX_CHANGES_SHOWN ? changes.slice(-MAX_CHANGES_SHOWN) : changes;
  if (shown.length < changes.length) {
    console.log(`  … ${changes.length - shown.length} earlier changes not shown`);
  }
  for (const r of [...(shown.length === changes.length ? [first] : []), ...shown]) {
    const from = r.call.previous && r.changed ? `${r.call.previous.signal}→` : "";
    const levels = [
      r.call.levels.below !== undefined ? `below ${usd(r.call.levels.below)}` : null,
      r.call.levels.above !== undefined ? `above ${usd(r.call.levels.above)}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    console.log(
      `  ${pad(r.date, 11)}${pad(usd(r.price), 8)}${pad(from + r.call.signal, 14)}` +
        `${pad(r === first ? "(replay start)" : (r.call.change?.reason ?? ""), 20)}${pad(signed(r.card.score, 0), 6)}${levels}`,
    );
  }

  // What happened next. A health check, not a claim — see the header.
  const ahead = FORWARD[horizon];
  const indexOf = new Map(closes.map((c, i) => [c.date, i]));
  console.log(`\nPrice ${ahead} days after each day at a signal (health check, not a performance claim):`);
  for (const s of SIGNALS) {
    const moves = rows
      .filter((r) => r.call.signal === s)
      .map((r) => {
        const later = closes[indexOf.get(r.date)! + ahead];
        return later ? (later.close / r.price - 1) * 100 : null;
      })
      .filter((m): m is number => m !== null);
    if (moves.length === 0) {
      console.log(`  ${pad(s, 5)} no days with ${ahead} days of follow-up`);
      continue;
    }
    const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
    const up = Math.round((100 * moves.filter((m) => m > 0).length) / moves.length);
    console.log(`  ${pad(s, 5)} ${pad(`${moves.length} days`, 10)} average ${signed(avg)}%   higher ${up}% of the time`);
  }

  console.log(`\nToday (${last.date}, ${usd(last.price)}): ${last.call.signal}, ${last.call.confidence} confidence, since ${last.call.since}`);
  for (const f of last.card.factors) {
    const value = f.value == null ? "n/a" : `${signed(f.value, 2)}${f.unit === "pp" ? " pp" : "%"}`;
    console.log(`  ${pad(f.key, 14)}${pad(value, 12)}reading ${signed(f.reading, 0)}`);
  }
  console.log(`  ${pad("score", 26)}${signed(last.card.score, 0)}  →  baseline ${last.call.baseline}${last.call.pinned ? " (call pinned by a breached level)" : ""}`);

  // Constant output is only a failure if the evidence was not constant too:
  // a score that crossed the thresholds and still produced one signal means
  // the rules are stuck. A score that never left one side is a steady regime.
  const { enter } = RULES[horizon];
  const crossedBoth = Math.max(...scores) >= enter && Math.min(...scores) <= -enter;
  const distinct = SIGNALS.filter((s) => counts[s] > 0).length;
  if (distinct === 1 && crossedBoth) {
    console.error(`\nFAIL: ${horizon} never left ${last.call.signal} although its score crossed both thresholds.`);
    return false;
  }
  if (distinct === 1) {
    console.log(`\nNote: ${horizon} stayed ${last.call.signal} throughout — its score never reached the opposite threshold in this window.`);
  }
  return true;
}

function printRules(): void {
  console.log(`Rules ${RULES_VERSION}`);
  for (const horizon of ["short", "long"] as const) {
    const { enter, factors } = RULES[horizon];
    console.log(`\n  ${horizon}: open BUY/SELL at |score| ≥ ${enter}, give it up when the score crosses 0`);
    for (const [key, rule] of Object.entries(factors)) {
      console.log(`    ${pad(key, 14)}${JSON.stringify(rule)}`);
    }
    const { lookback, minDistancePct } = RULES.levels[horizon];
    console.log(`    ${pad("levels", 14)}${lookback}-day closing low/high, at least ${minDistancePct}% from price`);
  }
}

/**
 * ~1,000 daily closes of the gold proxy, for calibration only (see header).
 *
 * A kline's close is the price at the END of its UTC day, which is the same
 * instant as the production source's 00:00 reading for the NEXT day — so each
 * close is dated one day forward to keep the two sources on one convention.
 * The still-open kline for today is dropped: it is not a close yet.
 */
async function deepCloses(): Promise<DailyClose[]> {
  const res = await fetch(
    "https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1d&limit=1000",
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!res.ok) throw new Error(`deep history responded ${res.status}`);
  const klines = (await res.json()) as [number, string, string, string, string, number, number][];
  const now = Date.now();
  return klines
    .filter((k) => k[6] < now)
    .map((k) => ({
      date: new Date(k[0] + 86_400_000).toISOString().slice(0, 10),
      close: Number(k[4]),
    }));
}

/** One line per confirmation setting — the trade-off the rule is chosen on. */
function compareConfirmation(closes: DailyClose[], macro: MacroHistory | null): void {
  console.log("\n━━ CONFIRMATION RULE: readings that must agree before the baseline moves ━━");
  console.log(`  ${pad("", 8)}${pad("days", 6)}${pad("changes/mo", 12)}${pad("shortest", 10)}${pad("median", 8)}${pad("1–2 day calls", 15)}BUY / HOLD / SELL`);
  for (const horizon of ["short", "long"] as const) {
    for (const confirmDays of [1, 2, 3]) {
      const rows = replay(horizon, closes, macro, confirmDays);
      const spells = spellsOf(rows);
      const changes = rows.filter((r) => r.changed).length;
      const share = (s: Signal) =>
        `${Math.round((100 * rows.filter((r) => r.call.signal === s).length) / rows.length)}%`;
      console.log(
        `  ${pad(horizon, 8)}${pad(confirmDays, 6)}${pad((changes / (rows.length / 30.4)).toFixed(1), 12)}` +
          `${pad(spells[0]!, 10)}${pad(spells[Math.floor(spells.length / 2)]!, 8)}` +
          `${pad(spells.filter((d) => d <= 2).length, 15)}${SIGNALS.map(share).join(" / ")}` +
          (confirmDays === RULES.confirmDays ? "   ← current rule" : ""),
      );
    }
  }
}

async function main() {
  printRules();

  const closes = DEEP
    ? await deepCloses()
    : toDailyCloses(await coinGeckoProvider.getDailyHistory(365));
  // The replay span + a 90-day lookback + a year for the percentile.
  const { history } = await fetchMacroHistory(closes.length + 470);
  console.log(
    `\nData${DEEP ? " (deep, calibration-only source)" : ""}: ${closes.length} daily closes ` +
      `(${closes[0]?.date} → ${closes.at(-1)?.date}); ` +
      (history
        ? `macro history from ${history.real10y[0]?.date}`
        : "NO macro history — yield and dollar factors read neutral"),
  );

  let ok = true;
  for (const horizon of ["short", "long"] as const) {
    ok = report(horizon, replay(horizon, closes, history), closes) && ok;
  }
  compareConfirmation(closes, history);
  console.log("");
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error("[replay] FAILED:", err);
  process.exit(1);
});
