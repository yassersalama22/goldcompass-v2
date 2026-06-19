import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Market Insights",
  description:
    "Curated insights on gold market movements, central banks, and price analysis.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  return (
    <ComingSoon
      phase="Insights"
      title="Market Insights"
      description="Curated analysis on gold market movements, central banks, and prices."
    />
  );
}
