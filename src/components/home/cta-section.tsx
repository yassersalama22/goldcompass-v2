import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  const t = useTranslations("home.cta");

  return (
    <section className="bg-muted/40 border-t py-16 sm:py-20">
      <Container>
        <div className="bg-foreground text-background mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-2xl px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-bold sm:text-3xl">
            {t("heading")}
          </h2>
          <p className="text-background/80 max-w-xl text-pretty">
            {t("body")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              render={<Link href="/outlook" />}
              size="lg"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
            >
              {t("ctaOutlook")}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              render={<Link href="/calculator" />}
              size="lg"
              variant="outline"
              className="border-background/30 text-background hover:bg-background/10 hover:text-background bg-transparent"
            >
              {t("ctaCalculator")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
