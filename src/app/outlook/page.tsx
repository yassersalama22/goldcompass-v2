import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Gold Market Outlook",
  description:
    "Short-term and long-term gold market outlooks with supporting analysis.",
};

export default function OutlookPage() {
  return (
    <ComingSoon
      phase="Outlook"
      title="Gold Market Outlook"
      description="Short-term and long-term BUY/SELL views with the reasoning behind them."
    />
  );
}
