import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 border-t">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3 md:col-span-1">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm">
              Smart gold-investing guidance for everyday investors.
            </p>
          </div>

          <FooterColumn title="Quick Links" items={siteConfig.footerNav.quickLinks} />
          <FooterColumn title="Resources" items={siteConfig.footerNav.resources} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Weekly Gold Updates</h2>
            <p className="text-muted-foreground text-sm">
              Get the latest outlook and market insights in your inbox. Free, no spam.
            </p>
            <SubscribeForm source="footer" />
          </div>
        </div>

        <div className="text-muted-foreground mt-10 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {siteConfig.name}. Educational information only — not financial advice.
          </p>
          <Link href="/disclaimer" className="hover:text-foreground underline-offset-4 hover:underline">
            Disclaimer
          </Link>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { title: string; href: string }[];
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
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
