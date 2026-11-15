import type { Levels } from "@/types/signal";

import type { OutlookGenerator } from "./provider";
import { levelText, type GeneratedOutlook, type GenerationInput } from "./schema";

/**
 * Deterministic generator for exercising the pipeline without an API key or
 * network. It requests no adjustment, so the calls it "writes" are exactly the
 * scorecard's — and its output passes through the same validating schema as a
 * real response, which keeps that schema honest. NOT for production content.
 */
export function createMockGenerator(): OutlookGenerator {
  return {
    name: "Mock (deterministic)",

    async generate(input: GenerationInput): Promise<GeneratedOutlook> {
      const { spot, state, briefs, date } = input;

      const breaks = (levels: Levels): string =>
        [
          levels.below !== undefined ? `a daily close below ${levelText(levels.below)}` : null,
          levels.above !== undefined ? `a daily close above ${levelText(levels.above)}` : null,
        ]
          .filter(Boolean)
          .join(" or ");

      const call = (term: "short" | "long") => {
        const { call: outcome } = briefs[term].outcomes["0"];
        return {
          term,
          signal: outcome.signal,
          reason: `Placeholder rationale: the ${term}-term scorecard reads ${outcome.score}, which the rules map to ${outcome.signal}.`,
          invalidation: `This view would change on ${breaks(outcome.levels)}.`,
        };
      };

      return {
        summary: `Gold trades near ${levelText(spot.price)}, ${Math.abs(state.drawdownPct).toFixed(1)}% below its 52-week high. This is placeholder content generated without live research — replace with a real run before publishing.`,
        drivers: [
          {
            title: "Mock driver: no live research was performed",
            direction: "neutral",
            horizon: "both",
            eventDate: date,
            summary: "Placeholder entry so the pipeline can be exercised offline.",
            url: "https://example.com/mock-driver-1",
          },
          {
            title: "Mock driver: second placeholder",
            direction: "neutral",
            horizon: "both",
            eventDate: date,
            summary: "Placeholder entry so the pipeline can be exercised offline.",
            url: "https://example.com/mock-driver-2",
          },
        ],
        adjustments: {
          short: { step: 0, reason: "", driverIndexes: [] },
          long: { step: 0, reason: "", driverIndexes: [] },
        },
        calls: [call("short"), call("long")],
        analysisMarkdown: [
          "## Market overview",
          "",
          `Gold (XAU/USD) is trading near **${levelText(spot.price)}** per ounce.`,
          "",
          "_This is mock content for pipeline testing. A real generation run uses live web research._",
          "",
          "## Outlook",
          "",
          "See the short- and long-term calls above.",
        ].join("\n"),
        sources: [],
      };
    },
  };
}
