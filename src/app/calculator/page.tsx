import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Smart Gold Calculator",
  description:
    "Estimate how much gold your budget buys, break-even prices, and profit/loss scenarios.",
  alternates: { canonical: "/calculator" },
};

export default function CalculatorPage() {
  return (
    <ComingSoon
      phase="Calculator"
      title="Smart Gold Calculator"
      description="Enter a budget and purity to estimate quantity, break-even, and profit/loss."
    />
  );
}
