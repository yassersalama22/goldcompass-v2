import { Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";

/**
 * Inline newsletter capture for content pages (outlook, insights). The reader
 * just finished the content — this is the retention hook. `source` is passed
 * through to the newsletter provider for attribution.
 */
export function SubscribeCta({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`subscribe-heading-${source}`}
      className={cn("bg-muted/40 space-y-3 rounded-lg border p-5", className)}
    >
      <h2
        id={`subscribe-heading-${source}`}
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Mail className="text-gold-strong size-5" aria-hidden="true" />
        Get the weekly gold update
      </h2>
      <p className="text-muted-foreground text-sm">
        The latest outlook and market insights in your inbox. Free, no spam —
        unsubscribe anytime.
      </p>
      <SubscribeForm source={source} className="max-w-md" />
    </section>
  );
}
