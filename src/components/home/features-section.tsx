import Link from "next/link";
import { ArrowRight, Calculator, LineChart } from "lucide-react";

import { Container } from "@/components/layout/container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    href: "/trends",
    Icon: LineChart,
    title: "Live gold price trends",
    description:
      "Track the XAU/USD spot price with an interactive 30-day chart, refreshed throughout the day.",
    cta: "View trends",
  },
  {
    href: "/calculator",
    Icon: Calculator,
    title: "Smart gold calculator",
    description:
      "Enter a budget and purity to estimate how much gold you can buy, your break-even price, and profit/loss scenarios.",
    cta: "Open calculator",
  },
];

export function FeaturesSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="bg-muted/40 border-y py-16 sm:py-20"
    >
      <Container className="space-y-8">
        <div className="space-y-2">
          <h2 id="features-heading" className="text-3xl font-bold">
            Tools to guide your decisions
          </h2>
          <p className="text-muted-foreground max-w-prose">
            Practical, data-driven tools designed for everyday investors.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ href, Icon, title, description, cta }) => (
            <Card key={href} className="flex flex-col">
              <CardHeader>
                <div className="bg-accent text-gold flex size-11 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="mt-3 text-xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link
                  href={href}
                  className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {cta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
