import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <Container className="flex flex-col items-center gap-6 py-24 text-center">
      <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-medium">
        Navigate the gold market with confidence
      </span>
      <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">
        Smart, clear guidance for{" "}
        <span className="text-gold">gold investors</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">
        Market outlooks, live price trends, and a smart gold calculator — built
        to help everyday investors make informed decisions.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/outlook" />} size="lg">
          View Outlook
        </Button>
        <Button render={<Link href="/calculator" />} size="lg" variant="outline">
          Gold Calculator
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Educational information only — not financial advice.
      </p>
    </Container>
  );
}
