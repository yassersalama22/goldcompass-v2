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
