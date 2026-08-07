export type NavItem = {
  /**
   * Message key under the `nav` namespace, not display text. The label is
   * resolved per locale at render time — this file describes site *structure*,
   * and structure is the same in every language.
   */
  key: string;
  href: string;
};

export const siteConfig = {
  name: "GoldCompass",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://goldcompass.app",
  /** Primary navigation, shown in the header and mobile menu. */
  mainNav: [
    { key: "outlook", href: "/outlook" },
    { key: "trends", href: "/trends" },
    { key: "insights", href: "/insights" },
    { key: "about", href: "/about" },
  ] satisfies NavItem[],
  footerNav: {
    quickLinks: [
      { key: "outlook", href: "/outlook" },
      { key: "trends", href: "/trends" },
      { key: "calculator", href: "/calculator" },
      { key: "insights", href: "/insights" },
    ] satisfies NavItem[],
    resources: [
      { key: "about", href: "/about" },
      { key: "methodology", href: "/methodology" },
      { key: "aiDisclosure", href: "/ai-disclosure" },
      { key: "disclaimer", href: "/disclaimer" },
    ] satisfies NavItem[],
  },
};

export type SiteConfig = typeof siteConfig;
