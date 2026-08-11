"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Shared control styling, kept identical to the flagship calculator. */
export const inputClass =
  "w-full rounded-lg border border-input bg-background py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring";

/**
 * Mirrors the current inputs into the query string without navigating, so any
 * calculation can be linked or bookmarked. Entries with an empty value are
 * omitted to keep shared URLs short.
 */
export function useUrlState(params: Record<string, string>) {
  // Serialized so the effect compares by value, not by object identity.
  const serialized = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== "")
  ).toString();

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (serialized ? `?${serialized}` : "")
    );
  }, [serialized]);
}

/**
 * Spot price state: seeded from the server-rendered live quote, overridable by
 * the user, and restorable from a `?spot=` link. `overridden` is tracked so the
 * "stale" badge and the reset button only appear when they mean something.
 */
export function useSpotState(initialSpot: number | null) {
  const searchParams = useSearchParams();
  const fromUrl = parseFloat(searchParams.get("spot") ?? "");
  const hasUrlSpot = !isNaN(fromUrl) && fromUrl > 0;

  const [spot, setSpotRaw] = useState(() => {
    if (hasUrlSpot) return fromUrl.toFixed(2);
    return initialSpot != null ? initialSpot.toFixed(2) : "";
  });
  const [overridden, setOverridden] = useState(hasUrlSpot);

  function setSpot(value: string) {
    setSpotRaw(value);
    setOverridden(true);
  }

  function reset() {
    if (initialSpot != null) {
      setSpotRaw(initialSpot.toFixed(2));
      setOverridden(false);
    }
  }

  return { spot, setSpot, overridden, reset, urlValue: overridden ? spot : "" };
}

interface NumberFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  min?: string;
  step?: string;
  placeholder?: string;
  hint?: ReactNode;
  action?: ReactNode;
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = "0",
  step = "any",
  placeholder,
  hint,
  action,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        {prefix ? (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-sm">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, prefix ? "ps-7" : "ps-3", suffix ? "pe-12" : "pe-3")}
        />
        {suffix ? (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-sm">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: readonly { key: T; label: string }[];
  hint?: ReactNode;
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(inputClass, "cursor-pointer px-3")}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

interface PercentSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  step?: number;
  hint?: ReactNode;
}

export function PercentSlider({
  label,
  value,
  onChange,
  max = 15,
  step = 0.5,
  hint,
}: PercentSliderProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-gold-strong text-sm font-semibold tabular-nums">
          {value.toFixed(1)}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-valuetext={`${value.toFixed(1)} percent`}
        className="w-full cursor-pointer accent-[var(--color-gold)]"
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

interface SpotFieldProps {
  value: string;
  onChange: (value: string) => void;
  overridden: boolean;
  onReset: () => void;
  initialSpot: number | null;
  isStale: boolean;
  label?: string;
}

/** Spot price input pre-seeded from the server, with a reset-to-live affordance. */
export function SpotField({
  value,
  onChange,
  overridden,
  onReset,
  initialSpot,
  isStale,
  label = "Spot price (XAU/USD)",
}: SpotFieldProps) {
  return (
    <NumberField
      label={
        <>
          {label}
          {isStale && !overridden ? (
            <Badge variant="outline" className="ms-1.5 h-4 text-[10px]">
              stale
            </Badge>
          ) : null}
        </>
      }
      value={value}
      onChange={onChange}
      prefix="$"
      min="1"
      step="1"
      action={
        overridden && initialSpot != null ? (
          <button
            type="button"
            onClick={onReset}
            className="text-gold-strong inline-flex items-center gap-1 text-xs hover:underline"
            aria-label="Reset spot price to live price"
          >
            <RotateCcw className="size-3" />
            Reset to live
          </button>
        ) : null
      }
      hint={
        initialSpot == null
          ? "Live price unavailable — enter the current spot price manually."
          : undefined
      }
    />
  );
}
