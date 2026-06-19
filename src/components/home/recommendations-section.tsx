import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SignalBadge } from "@/components/home/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { recommendations } from "@/data/recommendations";

export function RecommendationsSection() {
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
          {recommendations.map((rec) => (
            <Card key={rec.term} className="border-l-gold border-l-4">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">{rec.term}</CardTitle>
                  <SignalBadge signal={rec.signal} />
                </div>
                <CardDescription className="text-sm font-medium">
                  {rec.horizon}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{rec.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
