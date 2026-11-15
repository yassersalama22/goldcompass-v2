/**
 * Signal logic — how an outlook call is set (Aureus v3, §12).
 *
 *   market-state  deterministic facts from a year of prices + macro history
 *   scorecard     facts → factor readings → baseline signal + confidence
 *   standing      baseline + frozen levels + bounded adjustment → today's call
 *
 * Everything here is pure and free of `server-only`, so the pipeline scripts,
 * the replay and the guard script all run the exact code that sets the
 * published call.
 */
export { buildMarketState, toDailyCloses } from "./market-state";
export type { DailyClose, MarketState } from "./market-state";
export {
  RULES,
  RULES_VERSION,
  baselineFrom,
  confidenceFor,
  priorScores,
  scoreFor,
  scoreLong,
  scoreShort,
} from "./scorecard";
export { deriveLevels, findBreach, previewOutcomes, resolveCall } from "./standing";
export type { Breach, Resolution, ResolveInput } from "./standing";
export type { StandingCall } from "@/types/signal";
export { artifactIssues } from "./integrity";
export {
  entryBefore,
  historyPath,
  outlookDir,
  pendingHistoryPath,
  readHistory,
  withEntry,
  writeHistory,
} from "./history";
