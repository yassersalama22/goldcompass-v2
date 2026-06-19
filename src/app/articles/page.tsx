import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Articles",
  description: "Educational articles and analysis on gold investing.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  return (
    <ComingSoon
      phase="Articles"
      title="Articles"
      description="In-depth, educational articles on gold investing and market analysis."
    />
  );
}
