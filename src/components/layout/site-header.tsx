import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Skip link for keyboard / screen-reader users */}
      <a
        href="#main"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:ring-2"
      >
        {t("header.skipToContent")}
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-2">
          <MainNav />
          <LanguageSwitcher className="hidden sm:flex" />
          <ThemeToggle />
          <Button render={<Link href="/calculator" />} size="sm" className="hidden sm:inline-flex">
            {t("nav.calculator")}
          </Button>
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
