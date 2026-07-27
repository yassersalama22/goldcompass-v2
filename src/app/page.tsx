import type { Metadata } from "next";

import { Hero } from "@/components/home/hero";
import { RecommendationsSection } from "@/components/home/recommendations-section";
import { FeaturesSection } from "@/components/home/features-section";
import { InsightsSection } from "@/components/home/insights-section";
import { CtaSection } from "@/components/home/cta-section";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// This page renders the current outlook and the three latest articles, so it has
// to age like they do. Without this it prerenders fully static and emits
// `s-maxage=31536000`, which Cloudflare now honours — a merged outlook PR would
// stay invisible at the edge for a year unless someone purged by hand.
export const revalidate = 1800;

export default function HomePage() {
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
      <Hero />
      <RecommendationsSection />
      <FeaturesSection />
      <InsightsSection />
      <CtaSection />
    </>
  );
}
