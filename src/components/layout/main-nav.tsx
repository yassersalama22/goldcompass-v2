"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig, type NavItem } from "@/config/site";
import { cn } from "@/lib/utils";

/** Desktop primary navigation with active-route highlighting. */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {siteConfig.mainNav.map((item: NavItem) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "text-foreground"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
