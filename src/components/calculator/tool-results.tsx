import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Presentational result primitives shared by the tool pages. No "use client"
 * directive — these hold no state, so they compile into whichever boundary
 * imports them.
 */

export function ResultStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "bull" | "bear";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p
          className={cn(
            "text-3xl font-bold tabular-nums sm:text-4xl",
            tone === "bull" && "text-bull",
            tone === "bear" && "text-bear"
          )}
        >
          {value}
        </p>
        {sub ? <div className="text-muted-foreground text-sm">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export function EmptyResults({ message }: { message: string }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <span className="mb-3 text-3xl" aria-hidden="true">
        🪙
      </span>
      <p className="text-foreground font-medium">Enter your details to see results</p>
      <p className="mt-1 max-w-xs text-sm">{message}</p>
    </div>
  );
}

export function InputsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </div>
  );
}

export function ToolGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">{children}</div>;
}

/** Suspense fallback for the tools, which read search params on the client. */
export function ToolSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="bg-muted h-[420px] rounded-xl" />
      <div className="bg-muted h-[420px] rounded-xl" />
    </div>
  );
}
