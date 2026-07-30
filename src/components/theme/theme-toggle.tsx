"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-script";

/**
 * Light/dark toggle.
 *
 * Holds no React state on purpose. The current theme lives in one place — the
 * `dark` class on <html>, set pre-paint by ThemeScript — and both icons are
 * always rendered, with CSS deciding which is visible. That makes the server
 * markup theme-independent, so there is nothing for hydration to disagree
 * about and no `mounted` dance is needed.
 *
 * The accessible name is deliberately static ("Toggle dark mode") rather than
 * describing the current state: a state-dependent label or `aria-pressed`
 * would differ between server and client and reintroduce the mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    root.style.colorScheme = nextDark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextDark ? "dark" : "light");
    } catch {
      // Private mode / storage disabled — the toggle still works for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  );
}
