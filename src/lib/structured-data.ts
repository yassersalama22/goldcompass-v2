import { siteConfig } from "@/config/site";
import type { OutlookReport } from "@/types/outlook";
import type { Article } from "@/types/article";

/** schema.org Organization — identifies the brand to search engines. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: `${siteConfig.url}/icon.svg`,
  };
}

/** schema.org WebSite — enables sitelinks/site identity. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

/** schema.org Article for the gold-market outlook analysis. */
export function outlookArticleSchema(report: OutlookReport) {
  return {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    headline: `Gold Market Outlook — ${report.date}`,
    description: report.summary,
    datePublished: report.updatedAt,
    dateModified: report.updatedAt,
    url: `${siteConfig.url}/outlook`,
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
export function newsArticleSchema(article: Article) {
  const url = `${siteConfig.url}/articles/${article.slug}`;
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
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
    },
    isAccessibleForFree: true,
  };
}

/** schema.org FAQPage for the gold calculator page. */
export function calculatorFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much gold can I buy with $10,000?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "At current gold prices near $4,150/oz with a 5% dealer premium, $10,000 buys roughly 2.3 troy oz (about 71.5 grams) of pure 24K gold. Use the GoldCompass calculator for a precise figure based on live spot prices.",
        },
      },
      {
        "@type": "Question",
        name: "What is a dealer premium on gold?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A dealer premium is a markup charged above the spot (market) price to cover minting, refining, and dealer margins. Typical premiums: gold bars/coins 3–8%, jewelry 10–15%. Your investment only turns profitable once the spot price rises above your break-even (spot at purchase × (1 + premium)).",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between 24K, 18K, and 14K gold?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Karat indicates purity: 24K is 99.9% pure gold; 18K is 75% gold (750 fine); 14K is 58.3% gold (583 fine). Lower karat gold contains other metals (silver, copper) for durability. For investment purposes, 24K bars or coins are most common. The calculator adjusts quantity calculations for any purity level.",
        },
      },
      {
        "@type": "Question",
        name: "How is break-even price calculated for gold?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Break-even price = purchase spot price × (1 + dealer premium %). For example, buying at $4,000/oz with a 5% premium means gold must rise to $4,200 before you recover your investment when selling at spot. This calculator is for educational purposes and does not account for storage costs, taxes, or sell-side commissions.",
        },
      },
    ],
  };
}

/** schema.org BreadcrumbList. Pass ordered { name, path } items. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}
