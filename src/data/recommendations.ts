export type Signal = "BUY" | "SELL" | "HOLD";

export type Recommendation = {
  term: "Short-term" | "Long-term";
  horizon: string;
  signal: Signal;
  summary: string;
};

/**
 * Hand-authored market outlook. Source of truth for the home teaser and the
 * /outlook page (Phase 2). Update as the view changes.
 */
export const recommendations: Recommendation[] = [
  {
    term: "Short-term",
    horizon: "Next 30 days",
    signal: "SELL",
    summary:
      "Macro headwinds and a firmer dollar point to near-term downside. Patient buyers may find better entries ahead.",
  },
  {
    term: "Long-term",
    horizon: "Next 12 months",
    signal: "BUY",
    summary:
      "Structural demand, central-bank buying, and rate-cut expectations support a constructive longer-term outlook.",
  },
];
