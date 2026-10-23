import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { linkTag, richTags } from "@/i18n/rich";
import { Bot, Check, Database, ShieldCheck, TriangleAlert, UserCheck, X } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { aiDisclosurePageSchema } from "@/lib/structured-data";
import { formatLongDate } from "@/lib/format";
import { siteConfig } from "@/config/site";

/**
 * Structure only — the copy lives in the UI catalog under `aiDisclosure.*`.
 * Paragraphs containing links or emphasis are rich-text messages rendered with
 * `t.rich()` (see `@/i18n/rich`), so each stays one translatable sentence.
 */

/** Shown in the page footer and in the JSON-LD `dateModified`. */
const LAST_UPDATED = "2026-07-30";

const aiWrites = ["w1", "w2", "w3", "w4"] as const;
const aiNeverTouches = ["n1", "n2", "n3", "n4"] as const;
const pipelineSteps = ["s1", "s2", "s3", "s4", "s5"] as const;
const failureModes = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const neverDo = ["n1", "n2", "n3", "n4", "n5"] as const;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aiDisclosure" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: t("metaDescription"),
      openGraph: {
        title: t("ogTitle", { name: siteConfig.name }),
        description: t("ogDescription"),
        url: "/ai-disclosure",
        type: "website",
      },
    },
    "/ai-disclosure",
    locale,
  );
}

export default async function AiDisclosurePage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aiDisclosure");
  const rich = (key: string) => t.rich(key, richTags);

  return (
    <>
      <JsonLd data={aiDisclosurePageSchema(LAST_UPDATED, locale)} />

      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-gold-strong text-sm font-medium">{t("eyebrow")}</p>
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">{t("heading")}</h1>
          <p className="text-muted-foreground text-lg text-pretty">{t("lede")}</p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-16">
          {/* Split: what AI writes vs what it never touches */}
          <section aria-labelledby="split" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Bot className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="split" className="text-2xl font-bold">{t("split.heading")}</h2>
            </div>
            <p className="text-muted-foreground text-pretty">{t("split.intro")}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Bot className="text-gold-strong size-4" aria-hidden="true" />
                  {t("split.writesHeading")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {aiWrites.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-2 text-sm leading-6">
                      <Check className="text-gold-strong mt-1 size-3.5 shrink-0" aria-hidden="true" />
                      <span>{t(`split.writes.${item}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Database className="text-gold-strong size-4" aria-hidden="true" />
                  {t("split.neverHeading")}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {aiNeverTouches.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-2 text-sm leading-6">
                      <X className="text-gold-strong mt-1 size-3.5 shrink-0" aria-hidden="true" />
                      <span>{t(`split.never.${item}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* The system */}
          <section aria-labelledby="system" className="space-y-4">
            <h2 id="system" className="text-2xl font-bold">{t("system.heading")}</h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{t("system.p1")}</p>
              <p>{t("system.p2")}</p>
              <p>{t("system.p3")}</p>
            </div>
          </section>

          {/* Pipeline */}
          <section aria-labelledby="pipeline" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ShieldCheck className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="pipeline" className="text-2xl font-bold">{t("pipeline.heading")}</h2>
            </div>
            <p className="text-muted-foreground text-pretty">{t("pipeline.intro")}</p>
            <ol className="ms-1 space-y-3">
              {pipelineSteps.map((step, i) => (
                <li key={step} className="text-muted-foreground flex gap-3 text-pretty">
                  <span
                    className="bg-accent text-gold-strong mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span>{t(`pipeline.steps.${step}`)}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Human review */}
          <section aria-labelledby="review" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <UserCheck className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="review" className="text-2xl font-bold">{t("review.heading")}</h2>
            </div>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{t("review.p1")}</p>
              <p>{rich("review.p2")}</p>
            </div>
          </section>

          {/* Your data */}
          <section aria-labelledby="privacy" className="space-y-4">
            <h2 id="privacy" className="text-2xl font-bold">{t("privacy.heading")}</h2>
            <div className="text-muted-foreground space-y-4 text-pretty">
              <p>{t("privacy.p1")}</p>
              <p>{rich("privacy.p2")}</p>
            </div>
          </section>

          {/* Failure modes */}
          <section aria-labelledby="limits" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                <TriangleAlert className="text-gold-strong size-5" aria-hidden="true" />
              </div>
              <h2 id="limits" className="text-2xl font-bold">{t("limits.heading")}</h2>
            </div>
            <p className="text-muted-foreground text-pretty">{t("limits.intro")}</p>
            <div className="divide-border divide-y rounded-xl border">
              {failureModes.map((mode) => (
                <div key={mode} className="space-y-2 p-5">
                  <h3 className="font-semibold">{t(`limits.modes.${mode}.risk`)}</h3>
                  <p className="text-muted-foreground text-sm leading-6">
                    <span className="text-foreground font-medium">{t("limits.whatWeDo")} </span>
                    {t(`limits.modes.${mode}.mitigation`)}
                  </p>
                  <p className="text-muted-foreground text-sm leading-6">
                    <span className="text-foreground font-medium">{t("limits.whatRemains")} </span>
                    {t(`limits.modes.${mode}.residual`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Never */}
          <section aria-labelledby="never" className="space-y-4">
            <h2 id="never" className="text-2xl font-bold">{t("never.heading")}</h2>
            <ul className="space-y-2.5">
              {neverDo.map((item) => (
                <li key={item} className="text-muted-foreground flex gap-2 text-pretty">
                  <X className="text-gold-strong mt-1.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{t(`never.items.${item}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Disclaimer callout */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              {t.rich("callout", {
                ...richTags,
                strong: (chunks) => <strong>{chunks}</strong>,
                disclaimer: linkTag("/disclaimer", "font-medium underline underline-offset-4"),
              })}
            </p>
          </div>

          <p className="text-muted-foreground border-t pt-6 text-sm">
            {t.rich("lastUpdated", {
              date: formatLongDate(LAST_UPDATED, locale),
              time: (chunks) => <time dateTime={LAST_UPDATED}>{chunks}</time>,
            })}
          </p>
        </div>
      </Container>
    </>
  );
}
