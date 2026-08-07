import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { withLocaleMetadata, type LocaleParams } from "@/lib/seo";

import { Hero } from "@/components/home/hero";
import { RecommendationsSection } from "@/components/home/recommendations-section";
import { FeaturesSection } from "@/components/home/features-section";
import { InsightsSection } from "@/components/home/insights-section";
import { CtaSection } from "@/components/home/cta-section";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";

const pageMetadata: Metadata = {
};

// This page renders the current outlook and the three latest articles, so it has
// to age like they do. Without this it prerenders fully static and emits
// `s-maxage=31536000`, which Cloudflare now honours — a merged outlook PR would
// stay invisible at the edge for a year unless someone purged by hand.
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  return withLocaleMetadata(pageMetadata, "/", locale);
}

export default async function HomePage({ params }: LocaleParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={[organizationSchema(locale), websiteSchema(locale)]} />
      <Hero />
      <RecommendationsSection />
      <FeaturesSection />
      <InsightsSection />
      <CtaSection />
    </>
  );
}
