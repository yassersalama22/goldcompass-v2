import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Gold Price Trends",
  description:
    "Live XAU/USD spot price and an interactive 30-day gold price chart.",
  alternates: { canonical: "/trends" },
};

export default function TrendsPage() {
  return (
    <ComingSoon
      phase="Trends"
      title="Gold Price Trends"
      description="Live spot price and an interactive 30-day chart, updated regularly."
    />
  );
}
