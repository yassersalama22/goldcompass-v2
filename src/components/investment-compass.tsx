import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type Verdict = 'BUY' | 'HOLD' | 'SELL'

export interface OutlookData {
  /** Short label shown above the verdict, e.g. "Short Term Outlook". */
  label: string
  /** Time horizon, e.g. "Next 30 days". */
  horizon: string
  /** Current verdict — controls color and icon. */
  verdict: Verdict
  /** One-sentence rationale shown beneath the verdict. */
  rationale: string
  /** 0-100 conviction score. */
  conviction: number
}

// NOTE: Hardcoded for the MVP. In production these values are produced
// by the recommendation engine (server-side) and fetched here. To wire it
// up, replace this constant with a fetch to your API and surface loading /
// error states. The component itself is fully data-driven.
export const OUTLOOKS: readonly OutlookData[] = [
  {
    label: 'Short Term Outlook',
    horizon: 'Next 30 days',
    verdict: 'BUY',
    rationale:
      'Market volatility suggests a buying opportunity for the next 30 days.',
    conviction: 78,
  },
  {
    label: 'Long Term Outlook',
    horizon: 'Next 12 months',
    verdict: 'HOLD',
    rationale:
      'Steady fundamentals warrant patience — keep your existing allocation.',
    conviction: 64,
  },
] as const

// Lookup table used to keep visuals consistent across the gauge.
const VERDICT_STYLES: Record<
  Verdict,
  {
    label: string
    icon: typeof TrendingUp
    badgeClass: string
    textClass: string
    chipClass: string
    barClass: string
    haloClass: string
  }
> = {
  BUY: {
    label: 'Buy',
    icon: TrendingUp,
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-800',
    textClass: 'text-emerald-700',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barClass: 'bg-emerald-500',
    haloClass: 'from-emerald-100/70',
  },
  HOLD: {
    label: 'Hold',
    icon: Minus,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    textClass: 'text-amber-700',
    chipClass: 'bg-amber-50 text-amber-700 border-amber-200',
    barClass: 'bg-amber-500',
    haloClass: 'from-amber-100/70',
  },
  SELL: {
    label: 'Sell',
    icon: TrendingDown,
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    textClass: 'text-rose-700',
    chipClass: 'bg-rose-50 text-rose-700 border-rose-200',
    barClass: 'bg-rose-500',
    haloClass: 'from-rose-100/70',
  },
}

function ConvictionBar({ value, barClass }: { value: number; barClass: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Conviction</span>
        <span className="font-semibold text-foreground">{clamped}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', barClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

function OutlookCard({ outlook }: { outlook: OutlookData }) {
  const style = VERDICT_STYLES[outlook.verdict]
  const Icon = style.icon

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br to-transparent blur-2xl',
          style.haloClass
        )}
      />
      <CardHeader className="relative space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {outlook.label}
          </p>
          <Badge variant="outline" className="gap-1 text-[11px] font-medium">
            <Clock className="h-3 w-3" aria-hidden />
            {outlook.horizon}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex h-12 w-12 items-center justify-center rounded-xl border',
              style.chipClass
            )}
            aria-hidden
          >
            <Icon className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <div>
            <div
              className={cn(
                'text-3xl font-extrabold leading-none tracking-tight sm:text-4xl',
                style.textClass
              )}
            >
              {outlook.verdict}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Recommendation · {style.label}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <p className="text-sm leading-relaxed text-foreground/90">
          {outlook.rationale}
        </p>
        <ConvictionBar value={outlook.conviction} barClass={style.barClass} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-nautical-700" aria-hidden />
          <span>Updated today · Based on 12 indicators</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function InvestmentCompass() {
  return (
    <section
      id="compass"
      aria-labelledby="compass-title"
      className="relative scroll-mt-20"
    >
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-nautical-50/70 via-background to-background" />
      <div className="container py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="brand" className="mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-nautical-700" />
            Investment Compass · Live Recommendations
          </Badge>
          <h1
            id="compass-title"
            className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Clear gold guidance, without the jargon.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            See today&apos;s recommendation at a glance. We translate the data
            into one of three actions — Buy, Hold, or Sell — for both the short
            and long term.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:mt-12 md:grid-cols-2">
          {OUTLOOKS.map((o) => (
            <OutlookCard key={o.label} outlook={o} />
          ))}
        </div>

        <div className="mx-auto mt-6 flex max-w-5xl items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
          <span>
            These signals are indicative only. Always weigh them against your
            personal situation and goals.
          </span>
          <a
            href="#about"
            className="inline-flex shrink-0 items-center gap-1 font-medium text-nautical-700 hover:text-nautical-800"
          >
            How we decide
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
