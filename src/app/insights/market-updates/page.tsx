import type { Metadata } from "next";

import {
  InsightKindView,
  insightKindMetadata,
} from "@/components/articles/insight-kind-view";
import { getInsightKind } from "@/config/insight-kinds";

export const revalidate = 3600;

const def = getInsightKind("market-updates")!;

export const metadata: Metadata = insightKindMetadata(def);

export default function MarketUpdatesPage() {
  return <InsightKindView def={def} />;
}
