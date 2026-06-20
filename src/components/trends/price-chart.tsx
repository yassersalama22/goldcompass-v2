"use client";

import * as React from "react";

import { formatShortDate, formatUsd, formatUsdCompact } from "@/lib/format";
import type { PricePoint } from "@/types/price";

// Fixed viewBox coordinate space; the SVG stretches to the element box
// (preserveAspectRatio="none") and strokes stay crisp via non-scaling-stroke.
const W = 800;
const H = 280;
const PAD_TOP = 24;
const PAD_BOTTOM = 24;

export function PriceChart({ points }: { points: PricePoint[] }) {
  const [hover, setHover] = React.useState<number | null>(null);

  const geom = React.useMemo(() => {
    if (points.length < 2) return null;
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const n = points.length;

    const x = (i: number) => (i / (n - 1)) * W;
    const y = (price: number) =>
      PAD_TOP + (1 - (price - min) / range) * (H - PAD_TOP - PAD_BOTTOM);

    const line = points.map((p, i) => `${x(i)},${y(p.price)}`).join(" ");
    const area = `M0,${H} L${points
      .map((p, i) => `${x(i)},${y(p.price)}`)
      .join(" L")} L${W},${H} Z`;

    return { min, max, n, x, y, line, area };
  }, [points]);

  if (!geom) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Not enough data to draw a chart.
      </p>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const up = last.price >= first.price;
  const lineColor = up ? "var(--bull)" : "var(--bear)";

  const active = hover != null ? points[hover] : null;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(Math.min(1, Math.max(0, ratio)) * (geom!.n - 1));
    setHover(i);
  }

  return (
    <figure className="space-y-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-64 w-full touch-none sm:h-72"
          role="img"
          aria-label={`Gold price over the last 30 days: from ${formatUsd(
            first.price,
          )} on ${formatShortDate(first.t)} to ${formatUsd(
            last.price,
          )} on ${formatShortDate(last.t)}. Range ${formatUsd(
            geom.min,
          )} to ${formatUsd(geom.max)}.`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={geom.area} fill="url(#price-area)" />
          <polyline
            points={geom.line}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {active ? (
            <g>
              <line
                x1={geom.x(hover!)}
                y1={PAD_TOP}
                x2={geom.x(hover!)}
                y2={H - PAD_BOTTOM}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={geom.x(hover!)}
                cy={geom.y(active.price)}
                r={4}
                fill={lineColor}
                stroke="var(--background)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
        </svg>

        {/* High / low labels overlaid in the plot */}
        <span className="text-muted-foreground pointer-events-none absolute top-0 left-0 text-xs tabular-nums">
          {formatUsdCompact(geom.max)}
        </span>
        <span className="text-muted-foreground pointer-events-none absolute bottom-0 left-0 text-xs tabular-nums">
          {formatUsdCompact(geom.min)}
        </span>

        {/* Tooltip — positioned by percentage so it tracks the viewBox. */}
        {active ? (
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs shadow-md"
            style={{
              left: `${(geom.x(hover!) / W) * 100}%`,
              top: `${(geom.y(active.price) / H) * 100}%`,
            }}
          >
            <div className="font-semibold tabular-nums">
              {formatUsd(active.price)}
            </div>
            <div className="text-muted-foreground">
              {formatShortDate(active.t)}
            </div>
          </div>
        ) : null}
      </div>

      <figcaption className="text-muted-foreground flex justify-between text-xs">
        <span>{formatShortDate(first.t)}</span>
        <span>{formatShortDate(last.t)}</span>
      </figcaption>

      {/* Screen-reader / no-JS data table */}
      <table className="sr-only">
        <caption>Gold price (USD/oz), last 30 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.t}>
              <td>{formatShortDate(p.t)}</td>
              <td>{formatUsd(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
