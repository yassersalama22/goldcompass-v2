import type { Metadata } from "next";

import { Container } from "@/components/layout/container";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "GoldCompass provides educational information only and not financial advice.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <Container className="max-w-2xl space-y-4 py-16">
      <h1 className="text-3xl font-bold">Disclaimer</h1>
      <p className="text-muted-foreground">
        The information provided by GoldCompass is for general educational and
        informational purposes only. It does not constitute financial,
        investment, tax, or legal advice, and should not be relied upon as such.
      </p>
      <p className="text-muted-foreground">
        Gold and other precious-metal investments carry risk, and past
        performance is not indicative of future results. Always do your own
        research and consult a qualified professional before making any
        investment decision.
      </p>
    </Container>
  );
}
