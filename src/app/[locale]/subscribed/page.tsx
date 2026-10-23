import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { linkTag, richTags } from "@/i18n/rich";
import { Check, Compass, LineChart, Calculator, Newspaper } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/**
 * Landing page for the newsletter provider's "after confirming" redirect —
 * every double-opt-in subscriber lands here after clicking the confirm link in
 * their email. Deliberately `noindex` (thin, no search intent) and kept out of
 * `sitemap.ts`; it exists to bring a fresh subscriber straight into the content.
 */
/** Structure only — copy lives in the catalog under `subscribed.*`. */
const nextSteps = [
  { key: "outlook", icon: Compass, href: "/outlook" },
  { key: "trends", icon: LineChart, href: "/trends" },
  { key: "calculator", icon: Calculator, href: "/calculator" },
  { key: "insights", icon: Newspaper, href: "/insights" },
] as const;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscribed" });
  return withLocaleMetadata(
    {
      title: t("metaTitle"),
      description: t("metaDescription", { name: siteConfig.name }),
      robots: { index: false, follow: true },
    },
    "/subscribed",
    locale,
  );
}

export default async function SubscribedPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscribed");

  return (
    <Container className="py-12 sm:py-16">
      {/* Confirmation */}
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="bg-bull/10 mx-auto flex size-14 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <Check className="text-bull size-7" strokeWidth={2.5} />
        </div>

        <h1 className="mt-6 text-3xl font-bold text-balance sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          {t("lede", { name: siteConfig.name })}
        </p>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          {t("noSpam")}
        </p>
      </div>

      {/* Start reading */}
      <section aria-labelledby="start-reading" className="mx-auto mt-14 max-w-4xl">
        <h2 id="start-reading" className="text-center text-2xl font-bold">
          {t("startHere")}
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {nextSteps.map(({ key, icon: Icon, href }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-6 text-gold-strong" aria-hidden="true" />
              <h3 className="mt-3 font-semibold group-hover:text-gold-strong">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
                {t(`steps.${key}.body`)}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center">
          <Button render={<Link href="/outlook" />} size="lg">
            {t("cta")}
          </Button>
        </p>
      </section>

      {/* Disclaimer */}
      <section className="mx-auto mt-14 max-w-4xl">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p>
            {t.rich("callout", {
              ...richTags,
              name: siteConfig.name,
              strong: (chunks) => <strong>{chunks}</strong>,
              disclaimer: linkTag("/disclaimer", "font-medium underline underline-offset-4"),
            })}
          </p>
        </div>
      </section>
    </Container>
  );
}
