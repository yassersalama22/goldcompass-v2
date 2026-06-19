import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "About",
  description: "About GoldCompass and our approach to gold-investing guidance.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <ComingSoon
      phase="About"
      title="About GoldCompass"
      description="Our mission: clear, trustworthy gold-investing guidance for everyone."
    />
  );
}
