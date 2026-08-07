import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { siteConfig, type NavItem } from "@/config/site";

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="bg-muted/40 border-t">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3 md:col-span-1">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm">
              {t("footer.tagline")}
            </p>
          </div>

          <FooterColumn
            title={t("footer.quickLinks")}
            items={siteConfig.footerNav.quickLinks}
            label={(key) => t(`nav.${key}`)}
          />
          <FooterColumn
            title={t("footer.resources")}
            items={siteConfig.footerNav.resources}
            label={(key) => t(`nav.${key}`)}
          />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">{t("footer.newsletterHeading")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("footer.newsletterBody")}
            </p>
            <SubscribeForm source="footer" />
          </div>
        </div>

        <div className="text-muted-foreground mt-10 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { name: siteConfig.name })}</p>
          <Link href="/disclaimer" className="hover:text-foreground underline-offset-4 hover:underline">
            {t("footer.disclaimer")}
          </Link>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
  label,
}: {
  title: string;
  items: NavItem[];
  /** Resolves a nav key to its localized label — passed in so this stays a
   *  plain presentational component with no translation context of its own. */
  label: (key: string) => string;
}) {
  return (
    <nav aria-label={title} className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              {label(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
