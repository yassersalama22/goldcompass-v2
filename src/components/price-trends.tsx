import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowUpRight, LineChart as LineChartIcon, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PricePoint {
  date: string
  price: number
}

/**
 * Placeholder 30-day gold price series (USD per troy ounce).
 *
 * TODO: Replace this with a real fetch when backend is ready. Examples:
 *   - CoinGecko:        https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=30
 *   - MetalPriceAPI:    https://api.metalpriceapi.com/v1/timeframe?api_key=YOUR_KEY&start_date=...&end_date=...&base=USD&currencies=XAU
 *   - Metals.dev:       https://api.metals.dev/v1/timeseries?api_key=YOUR_KEY&start_date=...&end_date=...&base=XAU&currencies=USD
 *
 * Recommended pattern:
 *   const { data } = useQuery(['gold-30d'], fetchGoldHistory)
 * Then map the API rows into { date: 'MMM D', price: number }.
 */
function generatePlaceholderSeries(): PricePoint[] {
  const days = 30
  const today = new Date()
  const series: PricePoint[] = []
  let price = 2360
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    // Deterministic-ish drift so each refresh shows the same shape.
    const wave = Math.sin(i / 3.2) * 14
    const drift = (days - i) * 0.9
    const noise = ((i * 37) % 11) - 5
    price = 2360 + wave + drift + noise
    series.push({
      date: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      price: Math.round(price * 100) / 100,
    })
  }
  return series
}

const formatUSD = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

interface TooltipPayloadItem {
  value?: number
  payload?: PricePoint
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const value = payload[0].value
  if (!point || typeof value !== 'number') return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-card">
      <div className="font-medium text-muted-foreground">{point.date}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">
        {formatUSD(value)}
        <span className="ml-1 font-normal text-muted-foreground">/ oz</span>
      </div>
    </div>
  )
}

export function PriceTrends() {
  const data = useMemo(() => generatePlaceholderSeries(), [])

  const first = data[0].price
  const last = data[data.length - 1].price
  const change = last - first
  const changePct = (change / first) * 100
  const isUp = change >= 0

  return (
    <section
      id="trends"
      aria-labelledby="trends-title"
      className="scroll-mt-20 border-t border-border bg-muted/30"
    >
      <div className="container py-14 sm:py-16 lg:py-20">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="brand" className="mb-3">
              <LineChartIcon className="h-3 w-3" />
              30-day price history
            </Badge>
            <h2
              id="trends-title"
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Gold Price Trends
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Spot the recent direction of gold (USD per troy ounce). A simple
              view to help you understand the why behind today&apos;s
              recommendation.
            </p>
          </div>
          <a
            href="#insights"
            className="inline-flex items-center gap-1 text-sm font-medium text-nautical-700 hover:text-nautical-800"
          >
            Read the analysis
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/70 bg-background/60 sm:items-center">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Spot price · USD / oz
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {formatUSD(last)}
                </span>
                <span
                  className={
                    isUp
                      ? 'inline-flex items-center gap-1 text-sm font-semibold text-emerald-700'
                      : 'inline-flex items-center gap-1 text-sm font-semibold text-rose-700'
                  }
                >
                  <TrendingUp
                    className={isUp ? 'h-4 w-4' : 'h-4 w-4 rotate-180'}
                    aria-hidden
                  />
                  {isUp ? '+' : ''}
                  {formatUSD(change)} ({changePct.toFixed(2)}%)
                </span>
                <span className="text-xs text-muted-foreground">
                  past 30 days
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px]">
              Demo data
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[260px] w-full px-1 pb-2 pt-4 sm:h-[320px] sm:px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8f2a2a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#8f2a2a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    domain={['dataMin - 10', 'dataMax + 10']}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: '#8f2a2a', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#8f2a2a"
                    strokeWidth={2.25}
                    fill="url(#priceFill)"
                    activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: '#8f2a2a' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <p className="mt-3 text-xs text-muted-foreground">
          Sample dataset for illustration. Live pricing will be sourced from a
          public API such as CoinGecko or MetalPriceAPI.
        </p>
      </div>
    </section>
  )
}
