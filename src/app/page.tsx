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
