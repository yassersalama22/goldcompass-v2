import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProsePage } from "@/components/pages/prose-page";
import { getPage, isPageTranslated } from "@/server/pages";
import { pageLocales } from "@/server/i18n/availability";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

const SLUG = "disclaimer";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const page = getPage(SLUG, locale);

  // Every locale that has a translation — computed across all of them, so the
  // English page does not advertise an Arabic sibling that does not exist.
  return withLocaleMetadata(
    { title: page.title, description: page.description },
    `/${SLUG}`,
    locale,
    pageLocales(SLUG),
  );
}

export default async function DisclaimerPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("page");

  return (
    <ProsePage
      page={getPage(SLUG, locale)}
      locale={locale}
      translated={isPageTranslated(SLUG, locale)}
      updatedLabel={t("lastUpdated")}
    />
  );
}
