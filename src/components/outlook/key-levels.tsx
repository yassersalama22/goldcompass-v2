import { MoneyText } from "@/components/market/num";
import { cn } from "@/lib/utils";
import type { ContentLang } from "@/server/i18n/availability";
import type { KeyLevel } from "@/types/outlook";

export function KeyLevels({ levels, content = {} }: { levels: KeyLevel[]; content?: ContentLang }) {
  if (levels.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {levels.map((level) => (
        <div key={level.label} className="bg-card flex flex-col gap-1 p-4">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase" {...content}>
            {level.label}
          </dt>
          <dd
            className={cn(
              "text-lg font-semibold tabular-nums",
              level.emphasis && "text-gold-strong",
            )}
          >
            {/* Artifact values are free text — "$4,160", "$4,000–$4,070" — made
                entirely of digits and bidi-neutral characters, which reorder
                against an RTL paragraph. */}
            <MoneyText text={level.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
