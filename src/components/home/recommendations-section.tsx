import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { ConfidenceMeter } from "@/components/market/confidence-meter";
import { SignalBadge } from "@/components/market/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";

import { contentLangProps } from "@/server/i18n/availability";
import { getPublishedOutlook, hasOutlookTranslation } from "@/server/outlook";

export async function RecommendationsSection() {
  // Single source of truth — same data the /outlook page and /api/v1 serve.
  const locale = await getLocale();
  const report = getPublishedOutlook(locale);
  if (!report) return null;
  const content = contentLangProps(hasOutlookTranslation(locale), locale);
  const t = await getTranslations("home.recommendations");

  return (
    <section aria-labelledby="outlook-heading" className="py-16 sm:py-20">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 id="outlook-heading" className="text-3xl font-bold">
              {t("heading")}
            </h2>
            <p className="text-muted-foreground max-w-prose">
              {t("intro")}
            </p>
          </div>
          <Link
            href="/outlook"
            className="text-gold-strong inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("viewAll")}
            <ArrowRight className="rtl:rotate-180 size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {report.calls.map((call) => (
            <Card key={call.term} className="border-s-gold border-s-4">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl" {...content}>
                    {call.label}
                  </CardTitle>
                  <SignalBadge signal={call.signal} />
                </div>
                <CardDescription className="text-sm font-medium" {...content}>
                  {call.horizon}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ConfidenceMeter confidence={call.confidence} size="sm" />
                <p className="text-muted-foreground" {...content}>
                  {call.reason}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
