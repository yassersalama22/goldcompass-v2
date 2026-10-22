import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { ArrowRight, Calculator } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function Hero() {
  const t = useTranslations();

  return (
    <section className="from-accent/40 relative overflow-hidden bg-gradient-to-b to-transparent">
      <Container className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <span className="border-gold/30 bg-background/60 text-foreground/80 rounded-full border px-3 py-1 text-xs font-medium">
          {t("home.hero.badge")}
        </span>
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl lg:text-6xl">
          {t.rich("home.hero.heading", {
            accent: (chunks) => <span className="text-gold-strong">{chunks}</span>,
          })}
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          {t("home.hero.lede")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/outlook" />} size="lg">
            {t("home.hero.ctaOutlook")}
            <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button
            render={<Link href="/calculator" />}
            size="lg"
            variant="outline"
          >
            <Calculator aria-hidden="true" />
            {t("nav.calculator")}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t("home.hero.disclaimer")}
        </p>
      </Container>
    </section>
  );
}
