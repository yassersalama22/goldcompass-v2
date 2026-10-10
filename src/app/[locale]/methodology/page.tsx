import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { linkTag, richTags } from "@/i18n/rich";
import {
  Database,
  Bot,
  UserCheck,
  RefreshCw,
  Scale,
  TriangleAlert,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { methodologyPageSchema } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

/**
 * Structure only — the copy lives in the UI catalog under `methodology.*`.
 * Paragraphs containing links or emphasis are rich-text messages rendered with
 * `t.rich()` (see `@/i18n/rich`), so each stays one translatable sentence.
 */

/** Meaning of each published signal — keep the catalog copy in sync with `signalSchema`. */
const signals = ["buy", "hold", "sell"] as const;
const confidence = ["high", "medium", "low"] as const;
const steps = ["s1", "s2", "s3", "s4"] as const;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "methodology" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: t("metaDescription"),
      openGraph: {
        title: t("ogTitle", { name: siteConfig.name }),
        description: t("ogDescription"),
        url: "/methodology",
        type: "website",
      },
    },
    "/methodology",
    locale,
  );
}

export default async function MethodologyPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("methodology");
  const rich = (key: string) => t.rich(key, richTags);

  return (
    <>
      <JsonLd data={methodologyPageSchema(locale)} />

      <Container className="py-12 sm:py-16">
        {/* Intro */}
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm font-medium text-gold-strong">{t("eyebrow")}</p>
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">{t("heading")}</h1>
          <p className="text-muted-foreground text-lg text-pretty">{t("lede")}</p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-16">
          {/* Data sources */}
          <section aria-labelledby="data" className="space-y-4">
            <SectionHeading id="data" icon={<Database className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("data.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("data.p1")}</p>
              <p>{rich("data.p2")}</p>
              <p>{rich("data.p3")}</p>
              <p>{rich("data.p4")}</p>
              <p>{rich("data.p5")}</p>
            </div>
          </section>

          {/* Generation */}
          <section aria-labelledby="generation" className="space-y-4">
            <SectionHeading id="generation" icon={<Bot className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("generation.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("generation.intro")}</p>
              <ol className="ms-1 space-y-3">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span
                      className="bg-accent text-gold-strong mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span>{t(`generation.steps.${step}`)}</span>
                  </li>
                ))}
              </ol>
              <p>{rich("generation.p1")}</p>
              <p>{rich("generation.p2")}</p>
              <p>{rich("generation.p3")}</p>
            </div>
          </section>

          {/* Human review */}
          <section aria-labelledby="review" className="space-y-4">
            <SectionHeading id="review" icon={<UserCheck className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("review.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("review.p1")}</p>
              <p>{rich("review.p2")}</p>
            </div>
          </section>

          {/* Signal meanings */}
          <section aria-labelledby="signals" className="space-y-4">
            <SectionHeading id="signals" icon={<Scale className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("signals.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("signals.intro")}</p>
            </div>

            <dl className="divide-border divide-y rounded-xl border">
              {signals.map((key) => (
                <div key={key} className="grid gap-1 p-4 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <dt className="font-semibold">{t(`signals.${key}.term`)}</dt>
                  <dd className="text-muted-foreground text-sm text-pretty">
                    {t(`signals.${key}.body`)}
                  </dd>
                </div>
              ))}
            </dl>

            <h3 id="confidence" className="scroll-mt-24 pt-2 font-semibold">
              {t("signals.confidenceHeading")}
            </h3>
            <p className="text-muted-foreground text-pretty">{rich("signals.confidenceIntro")}</p>
            <dl className="divide-border divide-y rounded-xl border">
              {confidence.map((key) => (
                <div key={key} className="grid gap-1 p-4 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <dt className="font-semibold">{t(`signals.${key}.term`)}</dt>
                  <dd className="text-muted-foreground text-sm text-pretty">
                    {t(`signals.${key}.body`)}
                  </dd>
                </div>
              ))}
            </dl>

            <h3 className="pt-2 font-semibold">{t("signals.invalidationHeading")}</h3>
            <p className="text-muted-foreground text-pretty">{rich("signals.invalidationBody")}</p>
          </section>

          {/* Cadence */}
          <section aria-labelledby="cadence" className="space-y-4">
            <SectionHeading id="cadence" icon={<RefreshCw className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("cadence.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("cadence.p1")}</p>
              <p>{rich("cadence.p2")}</p>
            </div>
          </section>

          {/* Calculator */}
          <section aria-labelledby="calculator" className="space-y-4">
            <h2 id="calculator" className="text-2xl font-bold">
              {t("calculator.heading")}
            </h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("calculator.p1")}</p>
              <p>{rich("calculator.p2")}</p>
            </div>
          </section>

          {/* Limitations */}
          <section aria-labelledby="limits" className="space-y-4">
            <SectionHeading id="limits" icon={<TriangleAlert className="size-5 text-gold-strong" aria-hidden="true" />}>
              {t("limits.heading")}
            </SectionHeading>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{rich("limits.p1")}</p>
              <p>{rich("limits.p2")}</p>
              <p>{rich("limits.p3")}</p>
            </div>
          </section>

          {/* Disclaimer callout — inherits the callout's amber text, so its tags
              are not the default gold-link / foreground-emphasis styles. */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              {t.rich("callout", {
                ...richTags,
                strong: (chunks) => <strong>{chunks}</strong>,
                disclaimer: linkTag("/disclaimer", "font-medium underline underline-offset-4"),
              })}
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}

function SectionHeading({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <h2 id={id} className="text-2xl font-bold">
        {children}
      </h2>
    </div>
  );
}
