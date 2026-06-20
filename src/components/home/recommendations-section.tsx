import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SignalBadge } from "@/components/market/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPublishedOutlook } from "@/server/outlook";

export function RecommendationsSection() {
  // Single source of truth — same data the /outlook page and /api/v1 serve.
  const report = getPublishedOutlook();
  if (!report) return null;

  return (
    <section aria-labelledby="outlook-heading" className="py-16 sm:py-20">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 id="outlook-heading" className="text-3xl font-bold">
              Current recommendations
            </h2>
            <p className="text-muted-foreground max-w-prose">
              Our latest read on the gold market across two time horizons.
            </p>
          </div>
          <Link
            href="/outlook"
            className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            View full analysis
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {report.calls.map((call) => (
            <Card key={call.term} className="border-l-gold border-l-4">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">{call.label}</CardTitle>
                  <SignalBadge signal={call.signal} />
                </div>
                <CardDescription className="text-sm font-medium">
                  {call.horizon}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{call.reason}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
