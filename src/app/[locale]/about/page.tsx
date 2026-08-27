import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { LineChart, Calculator, Newspaper, Compass, ShieldCheck, BookOpen } from "lucide-react";

import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { Button } from "@/components/ui/button";
import { aboutPageSchema } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

/**
 * Structure only — icons and destinations. The copy lives in the UI catalog
 * under `about.*` so it is translatable and covered by the catalog parity check;
 * this page is a designed card grid, not a prose document, so its strings belong
 * in a catalog rather than in a Markdown artifact.
 */
const whatWeDo = [
  { key: "outlook", icon: Compass, href: "/outlook" },
  { key: "trends", icon: LineChart, href: "/trends" },
  { key: "calculator", icon: Calculator, href: "/calculator" },
  { key: "insights", icon: Newspaper, href: "/insights" },
] as const;

const principles = [
  { key: "data", icon: ShieldCheck },
  { key: "cited", icon: BookOpen },
  { key: "educational", icon: Compass },
] as const;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: t("metaDescription"),
      openGraph: {
        title: t("ogTitle", { name: siteConfig.name }),
        description: t("ogDescription"),
        type: "website",
      },
    },
    "/about",
    locale,
  );
}

export default async function AboutPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <>
      <JsonLd data={aboutPageSchema(locale)} />

      <Container className="py-12 sm:py-16">
        {/* Intro */}
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm font-medium text-gold-strong">
            {t("eyebrow", { name: siteConfig.name })}
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl text-balance">{t("heading")}</h1>
          <p className="text-muted-foreground text-lg text-pretty">{t("lede")}</p>
        </div>

        {/* What we do */}
        <section aria-labelledby="what-we-do" className="mx-auto mt-16 max-w-4xl">
          <h2 id="what-we-do" className="text-2xl font-bold">
            {t("whatWeDoHeading")}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {whatWeDo.map(({ key, icon: Icon, href }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-6 text-gold-strong" aria-hidden="true" />
                <h3 className="mt-3 font-semibold group-hover:text-gold-strong">
                  {t(`whatWeDo.${key}.title`)}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
                  {t(`whatWeDo.${key}.body`)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* How we work / principles */}
        <section aria-labelledby="how-we-work" className="mx-auto mt-16 max-w-4xl">
          <h2 id="how-we-work" className="text-2xl font-bold">
            {t("howWeWorkHeading")}
          </h2>
          <div className="mt-6 space-y-5">
            {principles.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-4">
                <div className="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5 text-gold-strong" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(`principles.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-1 text-sm text-pretty">
                    {t(`principles.${key}.body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer callout */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              <strong>{t("disclaimerCalloutLabel")}</strong> {t("disclaimerCallout")}{" "}
              <Link href="/disclaimer" className="font-medium underline underline-offset-4">
                {t("disclaimerCalloutLink")}
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Subscribe CTA */}
        <section
          aria-labelledby="subscribe-heading"
          className="mx-auto mt-16 max-w-2xl rounded-2xl bg-foreground px-6 py-10 text-center text-background sm:px-12"
        >
          <h2 id="subscribe-heading" className="text-2xl font-bold">
            {t("subscribeHeading")}
          </h2>
          <p className="text-background/80 mx-auto mt-2 max-w-md text-pretty">
            {t("subscribeBody")}
          </p>
          <div className="mx-auto mt-6 max-w-md text-start">
            <SubscribeForm source="about" />
          </div>
          <p className="mt-6">
            <Button
              render={<Link href="/outlook" />}
              variant="outline"
              className="border-background/30 text-background hover:bg-background/10 hover:text-background bg-transparent"
            >
              {t("subscribeCta")}
            </Button>
          </p>
        </section>
      </Container>
    </>
  );
}
