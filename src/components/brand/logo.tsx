import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * GoldCompass brand mark: a compass rose in brand gold paired with the wordmark.
 * The SVG is decorative; the link carries the accessible name.
 */
export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="GoldCompass home"
      className={cn(
        "group inline-flex items-center gap-2 rounded-md font-heading text-lg font-bold tracking-tight",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <CompassMark className="text-gold size-7 shrink-0 transition-transform group-hover:rotate-45" />
      <span>
        Gold<span className="text-gold">Compass</span>
      </span>
    </Link>
  );
}

function CompassMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      {/* Compass needle */}
      <polygon points="12,6 14,12 12,18 10,12" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="var(--background)" stroke="none" />
    </svg>
  );
}
