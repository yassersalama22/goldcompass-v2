import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { featuredInsights } from "@/data/insights";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function InsightsSection() {
  return (
    <section aria-labelledby="insights-heading" className="py-16 sm:py-20">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 id="insights-heading" className="text-3xl font-bold">
              Market insights
            </h2>
            <p className="text-muted-foreground max-w-prose">
              Analysis on price moves, central banks, and what they mean for investors.
            </p>
          </div>
          <Link
            href="/insights"
            className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            All insights
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredInsights.map((insight) => (
            <Card
              key={insight.slug}
              className="relative transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{insight.category}</Badge>
                  <time
                    dateTime={insight.date}
                    className="text-muted-foreground text-xs"
                  >
                    {dateFormatter.format(new Date(insight.date))}
                  </time>
                </div>
                <CardTitle className="mt-2 text-lg leading-snug">
                  <Link
                    href="/insights"
                    className="hover:text-gold-strong after:absolute after:inset-0 focus-visible:underline"
                  >
                    {insight.title}
                  </Link>
                </CardTitle>
                <CardDescription>{insight.excerpt}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
