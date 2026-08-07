"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { siteConfig, type NavItem } from "@/config/site";
import { cn } from "@/lib/utils";

/** Desktop primary navigation with active-route highlighting. */
export function MainNav() {
  // Locale-independent: `/ar/outlook` reads back as `/outlook`, so the
  // active-route test below is written once and works in every language.
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav aria-label={t("header.primaryNavLabel")} className="hidden md:block">
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
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
