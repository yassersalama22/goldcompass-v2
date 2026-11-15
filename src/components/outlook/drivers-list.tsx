import { useLocale, useTranslations } from "next-intl";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { formatMediumDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContentLang } from "@/server/i18n/availability";
import type { Driver } from "@/types/signal";

/**
 * The dated events an outlook draws on — where current affairs enter the call
 * in a form a reader can check: each has a date, a direction for gold, and the
 * link the drafting system read it at.
 *
 * Title and summary are artifact prose (translated with the outlook); the date,
 * direction, horizon and link are data, so they are worded by the catalog.
 * Direction is a word and an icon as well as a colour (WCAG 1.4.1).
 */
const DIRECTION: Record<Driver["direction"], { Icon: typeof TrendingUp; tone: string }> = {
  bullish: { Icon: TrendingUp, tone: "text-bull" },
  bearish: { Icon: TrendingDown, tone: "text-bear" },
  neutral: { Icon: Minus, tone: "text-muted-foreground" },
};

export function DriversList({
  drivers,
  content = {},
}: {
  drivers: Driver[];
  content?: ContentLang;
}) {
  const t = useTranslations("outlook.drivers");
  const locale = useLocale();
  if (drivers.length === 0) return null;

  return (
    <section aria-labelledby="drivers-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="drivers-heading" className="text-2xl font-bold">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">{t("intro")}</p>
      </div>
      <ol className="divide-border divide-y rounded-xl border">
        {drivers.map((driver) => {
          const { Icon, tone } = DIRECTION[driver.direction];
          return (
            <li key={`${driver.url}-${driver.title}`} className="space-y-1.5 px-4 py-3">
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <time dateTime={driver.eventDate}>{formatMediumDate(driver.eventDate, locale)}</time>
                <span aria-hidden="true">·</span>
                <span className={cn("inline-flex items-center gap-1 font-medium", tone)}>
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {t(`direction.${driver.direction}`)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{t(`horizon.${driver.horizon}`)}</span>
              </p>
              <p className="font-medium">
                <a
                  href={driver.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-gold-strong underline underline-offset-4"
                  {...content}
                >
                  {driver.title}
                </a>
              </p>
              <p className="text-muted-foreground text-sm text-pretty" {...content}>
                {driver.summary}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
