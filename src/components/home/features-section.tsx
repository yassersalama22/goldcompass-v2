import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { ArrowRight, Calculator, LineChart } from "lucide-react";

import { Container } from "@/components/layout/container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Structure only — copy lives in the catalog under `home.features.<key>`. */
const features = [
  { key: "trends", href: "/trends", Icon: LineChart },
  { key: "calculator", href: "/calculator", Icon: Calculator },
] as const;

export function FeaturesSection() {
  const t = useTranslations("home.features");

  return (
    <section
      aria-labelledby="features-heading"
      className="bg-muted/40 border-y py-16 sm:py-20"
    >
      <Container className="space-y-8">
        <div className="space-y-2">
          <h2 id="features-heading" className="text-3xl font-bold">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground max-w-prose">
            {t("intro")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ key, href, Icon }) => (
            <Card key={href} className="flex flex-col">
              <CardHeader>
                <div className="bg-accent text-gold flex size-11 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="mt-3 text-xl">{t(`${key}.title`)}</CardTitle>
                <CardDescription>{t(`${key}.description`)}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link
                  href={href}
                  className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {t(`${key}.cta`)}
                  <ArrowRight className="rtl:rotate-180 size-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
