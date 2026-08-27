import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProsePage } from "@/components/pages/prose-page";
import { getPage, isPageTranslated } from "@/server/pages";
import { DEFAULT_LOCALE } from "@/config/locales";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

const SLUG = "disclaimer";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const page = getPage(SLUG, locale);

  // hreflang advertises this locale only when it actually has a translation —
  // a dangling alternate is worse than none, because it invites the wrong
  // language into results for the wrong audience.
  const available = isPageTranslated(SLUG, locale)
    ? undefined
    : [DEFAULT_LOCALE];

  return withLocaleMetadata(
    { title: page.title, description: page.description },
    `/${SLUG}`,
    locale,
    available,
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
      updatedLabel={t("lastUpdated")}
    />
  );
}
