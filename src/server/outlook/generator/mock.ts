import type { OutlookGenerator } from "./provider";
import type { GeneratedOutlook, GenerationInput } from "./schema";

/**
 * Deterministic generator for testing the pipeline without an API key or
 * network. Derives a plausible outlook from the supplied ground-truth data so
 * the end-to-end flow (fetch → generate → validate → write draft) can be
 * exercised offline. NOT for production content.
 */
export function createMockGenerator(): OutlookGenerator {
  return {
    name: "Mock (deterministic)",

    async generate(input: GenerationInput): Promise<GeneratedOutlook> {
      const { spot, series } = input;
      const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
      const trendDown = (series?.changePct30d ?? 0) < 0;

      const shortSignal = trendDown ? "SELL" : "HOLD";
      const support = Math.round(spot.price * 0.97);
      const resistance = Math.round(spot.price * 1.03);

      return {
        summary: `Gold trades near ${usd(spot.price)} (XAU/USD). This is placeholder editorial content generated without live research — replace with a real run before publishing.`,
        calls: [
          {
            term: "short",
            label: "Short-term",
            horizon: "Next 1–4 weeks",
            signal: shortSignal,
            confidence: "medium",
            reason: `Price action has been ${trendDown ? "soft" : "range-bound"} over the past month; near-term direction is unclear pending fresh catalysts.`,
            invalidation: `A decisive close above ${usd(resistance)} would improve the short-term tone.`,
          },
          {
            term: "long",
            label: "Long-term",
            horizon: "Next 3–12 months",
            signal: "BUY",
            confidence: "high",
            reason:
              "Structural demand and central-bank buying support a constructive longer-term view despite near-term noise.",
            invalidation: `A sustained break below ${usd(support)} would challenge the bullish thesis.`,
          },
        ],
        keyLevels: [
          { label: "Spot", value: usd(spot.price), emphasis: true },
          { label: "Near support", value: usd(support) },
          { label: "Near resistance", value: usd(resistance) },
          ...(series
            ? [
                { label: "30-day low", value: usd(series.min) },
                { label: "30-day high", value: usd(series.max) },
              ]
            : []),
        ],
        analysisMarkdown: [
          "## Market overview",
          "",
          `Gold (XAU/USD) is trading near **${usd(spot.price)}** per ounce${
            spot.changePct24h != null
              ? `, ${spot.changePct24h >= 0 ? "up" : "down"} ${Math.abs(spot.changePct24h).toFixed(2)}% over 24h`
              : ""
          }.${
            series
              ? ` Over the past 30 days the metal has moved ${series.changePct30d.toFixed(1)}%, ranging between **${usd(series.min)}** and **${usd(series.max)}**.`
              : ""
          }`,
          "",
          "_This is mock content for pipeline testing. A real generation run uses live web research for the sections below._",
          "",
          "## Key drivers",
          "",
          "- US dollar and real yields",
          "- Central-bank demand",
          "- Positioning and momentum",
          "",
          "## Outlook",
          "",
          "See the short- and long-term calls above.",
          "",
          "## Risks",
          "",
          "- A sharp move in the dollar or rates could invalidate the near-term view.",
        ].join("\n"),
        sources: [],
      };
    },
  };
}
