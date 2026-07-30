import Link from "next/link";

import { cn } from "@/lib/utils";
import { INSIGHT_KINDS } from "@/config/insight-kinds";

/**
 * Links between the full archive and the two kind views. Rendered as real
 * links (not client-side filter state) so each view is its own crawlable URL —
 * the whole point of the split.
 */
export function InsightFilterNav({ current }: { current: "all" | string }) {
  const items = [{ slug: "all", href: "/insights", label: "All insights" }, ...INSIGHT_KINDS];

  return (
    <nav aria-label="Filter insights" className="mb-8">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isCurrent = item.slug === current;
          return (
            <li key={item.slug}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
