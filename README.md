# GoldCompass

A high-trust gold investment advisory MVP — clean, plainspoken, and built for
everyday investors. The aesthetic is "The Accessible Advocate": Vanguard /
Fidelity-style trust signals, anchored by a deep maroon **Nautical Red** brand.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS** for styling, with shadcn-style design tokens
- **shadcn/ui-style primitives** (Button, Card, Badge, Alert) built locally
  on top of Radix UI's `Slot`
- **Recharts** for the gold-price line/area chart
- **Lucide-React** for icons (Anchor, Shield, TrendingUp, etc.)

## Getting started

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Page sections

1. **Site header** — sticky nav with a maroon anchor mark and mobile menu.
2. **Investment Compass (hero)** — two prominent gauges side-by-side:
   - **Short Term Outlook**: hardcoded `BUY` (green)
   - **Long Term Outlook**: hardcoded `HOLD` (amber)
   - Each card includes a one-sentence rationale, conviction bar, and a
     time-horizon chip. The component is fully data-driven via the `OUTLOOKS`
     constant in `src/components/investment-compass.tsx`.
3. **Gold Price Trends** — Recharts area chart over 30 days of
   placeholder data. See `generatePlaceholderSeries()` in
   `src/components/price-trends.tsx` for the API integration TODO
   (CoinGecko / MetalPriceAPI / Metals.dev).
4. **Market Insights & News** — a 3-card grid using calming, lifestyle
   Unsplash imagery. Each card links to a placeholder anchor.
5. **About** — the mission statement plus three trust pillars.
6. **Footer** — link columns and the verbatim required disclaimer surfaced
   inside an `Alert`.

## Wiring real data

Both the Investment Compass and the price chart are pure functions of their
input data. To go live:

- Replace the `OUTLOOKS` constant with a fetch / query for your
  recommendation engine output.
- Replace `generatePlaceholderSeries()` with a real API call. Suggested
  endpoints are listed inline in the file.

## Project structure

```
src/
├── App.tsx                          # composes the page sections
├── main.tsx                         # React entry
├── index.css                        # Tailwind + design tokens
├── lib/utils.ts                     # cn() helper
└── components/
    ├── site-header.tsx
    ├── investment-compass.tsx       # hero recommendation engine
    ├── price-trends.tsx             # Recharts price chart
    ├── market-insights.tsx          # article grid
    ├── about-section.tsx
    ├── site-footer.tsx              # incl. verbatim disclaimer
    └── ui/                          # shadcn-style primitives
        ├── alert.tsx
        ├── badge.tsx
        ├── button.tsx
        └── card.tsx
```
