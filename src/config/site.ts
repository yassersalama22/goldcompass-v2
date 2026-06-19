export type NavItem = {
  title: string;
  href: string;
};

export const siteConfig = {
  name: "GoldCompass",
  description:
    "Smart gold-investing guidance: clear outlooks, live price trends, a smart gold calculator, and market insights.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://goldcompass.app",
  /** Primary navigation, shown in the header and mobile menu. */
  mainNav: [
    { title: "Outlook", href: "/outlook" },
    { title: "Trends", href: "/trends" },
    { title: "Insights", href: "/insights" },
    { title: "Articles", href: "/articles" },
    { title: "About", href: "/about" },
  ] satisfies NavItem[],
  footerNav: {
    quickLinks: [
      { title: "Outlook", href: "/outlook" },
      { title: "Trends", href: "/trends" },
      { title: "Gold Calculator", href: "/calculator" },
      { title: "Articles", href: "/articles" },
    ] satisfies NavItem[],
    resources: [
      { title: "Market Insights", href: "/insights" },
      { title: "About", href: "/about" },
      { title: "Disclaimer", href: "/disclaimer" },
    ] satisfies NavItem[],
  },
};

export type SiteConfig = typeof siteConfig;
