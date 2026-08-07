import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import {
  InsightKindView,
  insightKindMetadata,
} from "@/components/articles/insight-kind-view";
import { getInsightKind } from "@/config/insight-kinds";
import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

export const revalidate = 3600;

const def = getInsightKind("explainers")!;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(insightKindMetadata(def), def.href, locale);
}

export default async function ExplainersPage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <InsightKindView def={def} locale={locale} />;
}
