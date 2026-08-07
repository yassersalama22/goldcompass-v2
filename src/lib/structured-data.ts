import { DEFAULT_LOCALE, localizePath, requireLocale } from "@/config/locales";
import { siteConfig } from "@/config/site";
import type { ToolDef } from "@/config/tools";
import { interpolate, messages } from "@/i18n/messages";
import type { OutlookReport } from "@/types/outlook";
import type { Article } from "@/types/article";

/**
 * JSON-LD builders.
 *
 * Every builder takes a `locale`, defaulting to the canonical one so a call site
 * that has not been localized yet emits exactly what it did before. Two things
 * depend on it:
 *
 *  - **URLs are locale-prefixed** via `localizePath`. A `url` or `@id` pointing
 *    at the English page from an Arabic page would tell search engines the two
 *    are the same document and undo the hreflang pairing.
 *  - **`inLanguage`** is declared on every page-level entity, which is how a
 *    crawler knows which audience the markup describes.
 *
 * Strings come from the UI catalog rather than being inlined, so the structured
 * data and the visible page cannot drift apart per locale.
 */

/** Absolute URL for a locale-independent path. */
function abs(path: string, locale: string): string {
  return `${siteConfig.url}${localizePath(path, locale)}`;
}

/** The publisher block, repeated by most page-level entities. */
function publisher() {
  return {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
  };
}

function lang(locale: string): string {
  return requireLocale(locale).hreflang;
}

/** schema.org Organization — identifies the brand to search engines. */
export function organizationSchema(locale: string = DEFAULT_LOCALE) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: messages(locale).site.shortDescription,
    logo: `${siteConfig.url}/icon.svg`,
  };
}

/** schema.org WebSite — enables sitelinks/site identity. */
export function websiteSchema(locale: string = DEFAULT_LOCALE) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: abs("/", locale),
    description: messages(locale).site.shortDescription,
    inLanguage: lang(locale),
  };
}

/** schema.org Article for the gold-market outlook analysis. */
export function outlookArticleSchema(
  report: OutlookReport,
  locale: string = DEFAULT_LOCALE,
) {
  return {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    headline: interpolate(messages(locale).schema.outlookHeadline, {
      date: report.date,
    }),
    description: report.summary,
    datePublished: report.updatedAt,
    dateModified: report.updatedAt,
    url: abs("/outlook", locale),
    inLanguage: lang(locale),
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
    },
    isAccessibleForFree: true,
  };
}

/** schema.org Article for a published article. */
export function newsArticleSchema(
  article: Article,
  locale: string = DEFAULT_LOCALE,
) {
  const url = abs(`/insights/${article.slug}`, locale);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.updatedAt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: article.category,
    keywords: article.tags.join(", "),
    inLanguage: lang(locale),
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
    },
    isAccessibleForFree: true,
  };
}

/** schema.org AboutPage for the /about route, with the Organization as its subject. */
export function aboutPageSchema(locale: string = DEFAULT_LOCALE) {
  const m = messages(locale);
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: interpolate(m.schema.aboutName, { name: siteConfig.name }),
    url: abs("/about", locale),
    inLanguage: lang(locale),
    mainEntity: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      description: m.site.shortDescription,
      logo: `${siteConfig.url}/icon.svg`,
    },
  };
}

/**
 * schema.org WebPage for /methodology. Declaring the publisher and the pages
 * it describes is an E-E-A-T signal for YMYL content: it tells search engines
 * this is the documented process behind our market calls.
 */
export function methodologyPageSchema(locale: string = DEFAULT_LOCALE) {
  const m = messages(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: interpolate(m.schema.methodologyName, { name: siteConfig.name }),
    url: abs("/methodology", locale),
    description: m.schema.methodologyDescription,
    inLanguage: lang(locale),
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    publisher: publisher(),
    about: [
      { "@type": "WebPage", url: abs("/outlook", locale) },
      { "@type": "WebPage", url: abs("/insights", locale) },
      { "@type": "WebPage", url: abs("/calculator", locale) },
    ],
    significantLink: abs("/ai-disclosure", locale),
  };
}

/** schema.org FAQPage for the gold calculator page. */
export function calculatorFaqSchema(locale: string = DEFAULT_LOCALE) {
  const faq = messages(locale).calculatorFaq;
  return faqSchema(
    [
      { question: faq.q1, answer: faq.a1 },
      { question: faq.q2, answer: faq.a2 },
      { question: faq.q3, answer: faq.a3 },
      { question: faq.q4, answer: faq.a4 },
    ],
    locale,
  );
}

/**
 * schema.org WebPage for /ai-disclosure. Kept distinct from the methodology
 * schema so the two pages declare different subjects rather than competing for
 * the same one.
 */
export function aiDisclosurePageSchema(
  lastUpdated: string,
  locale: string = DEFAULT_LOCALE,
) {
  const m = messages(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: interpolate(m.schema.aiDisclosureName, { name: siteConfig.name }),
    url: abs("/ai-disclosure", locale),
    description: m.schema.aiDisclosureDescription,
    dateModified: lastUpdated,
    inLanguage: lang(locale),
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    publisher: publisher(),
    significantLink: abs("/methodology", locale),
  };
}

/**
 * schema.org FAQPage from arbitrary Q&A pairs.
 *
 * Google requires the marked-up questions and answers to be visible on the
 * page, so callers must render the same array they pass here — see
 * `ToolPageShell`, which takes one `faqs` array and does both.
 */
export function faqSchema(
  faqs: { question: string; answer: string }[],
  locale: string = DEFAULT_LOCALE,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang(locale),
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/** schema.org WebApplication for a calculator tool page. */
export function toolApplicationSchema(
  tool: ToolDef,
  locale: string = DEFAULT_LOCALE,
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: abs(tool.href, locale),
    inLanguage: lang(locale),
    description: tool.description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: publisher(),
  };
}

/** schema.org BreadcrumbList. Pass ordered { name, path } items. */
export function breadcrumbSchema(
  items: { name: string; path: string }[],
  locale: string = DEFAULT_LOCALE,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path, locale),
    })),
  };
}
