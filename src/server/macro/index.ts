import { createFredProvider, snapshotFromHistory } from "./fred";
import type { MacroProvider } from "./provider";
import type { MacroHistory, MacroResult } from "@/types/macro";

export { FRED_ATTRIBUTION } from "./fred";
export type { MacroProvider } from "./provider";

/**
 * Macro data-access layer.
 *
 * Deliberately NOT marked `server-only`: unlike the price/outlook layers, the
 * only consumer is `scripts/generate-outlook.mts`, which runs under tsx outside
 * Next and would crash on that import. Nothing in `src/app` imports this — the
 * page reads the macro snapshot back out of the published artifact, so the
 * numbers a reader sees are the ones the analysis actually reasoned over.
 *
 * Inert when `FRED_API_KEY` is unset: the prompt omits the macro block (rather
 * than letting the model invent one) and the artifact carries no `macro`, so
 * the panel simply does not render. Same fail-soft pattern as the newsletter
 * and Turnstile providers.
 */
export function getMacroProvider(): MacroProvider | null {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;
  return createFredProvider(apiKey);
}

/** Never throws — a macro outage must not fail a generation run. */
export async function fetchMacroSnapshot(): Promise<MacroResult> {
  const fetchedAt = new Date().toISOString();
  const provider = getMacroProvider();

  if (!provider) {
    console.warn("[macro] FRED_API_KEY unset — generating without macro ground truth");
    return { ok: false, data: null, fetchedAt, stale: false };
  }

  try {
    const data = await provider.getSnapshot();
    return { ok: true, data, fetchedAt, stale: false };
  } catch (err) {
    console.warn("[macro] snapshot unavailable:", (err as Error).message);
    return { ok: false, data: null, fetchedAt, stale: true };
  }
}

/**
 * The raw series *and* the snapshot derived from them, from one set of fetches.
 *
 * The outlook pipeline needs both: the snapshot is stored in the artifact and
 * shown to readers, the history feeds the scorecard. Deriving the snapshot from
 * the same history guarantees the panel and the scorecard read the same data —
 * two separate fetches could straddle a FRED update and disagree.
 *
 * Never throws, for the same reason as `fetchMacroSnapshot`.
 */
export async function fetchMacroHistory(
  lookbackDays?: number,
): Promise<{ history: MacroHistory | null; snapshot: MacroResult }> {
  const fetchedAt = new Date().toISOString();
  const provider = getMacroProvider();

  if (!provider) {
    console.warn("[macro] FRED_API_KEY unset — generating without macro ground truth");
    return { history: null, snapshot: { ok: false, data: null, fetchedAt, stale: false } };
  }

  try {
    const history = await provider.getHistory(lookbackDays);
    return {
      history,
      snapshot: { ok: true, data: snapshotFromHistory(history), fetchedAt, stale: false },
    };
  } catch (err) {
    console.warn("[macro] history unavailable:", (err as Error).message);
    return { history: null, snapshot: { ok: false, data: null, fetchedAt, stale: true } };
  }
}
