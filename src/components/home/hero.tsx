import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="from-accent/40 relative overflow-hidden bg-gradient-to-b to-transparent">
      <Container className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <span className="border-gold/30 bg-background/60 text-foreground/80 rounded-full border px-3 py-1 text-xs font-medium">
          Navigate the gold market with confidence
        </span>
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl lg:text-6xl">
          Smart, clear guidance for{" "}
          <span className="text-gold-strong">gold investors</span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          Market outlooks, live price trends, and a smart calculator — everything
          everyday investors need to make informed decisions about gold.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/outlook" />} size="lg">
            View the outlook
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button
            render={<Link href="/calculator" />}
            size="lg"
            variant="outline"
          >
            <Calculator aria-hidden="true" />
            Gold Calculator
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Educational information only — not financial advice.
        </p>
      </Container>
    </section>
  );
}
