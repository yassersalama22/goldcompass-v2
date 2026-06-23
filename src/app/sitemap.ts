import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getAllArticles } from "@/server/articles";

const routes = ["", "/outlook", "/trends", "/insights", "/articles", "/calculator", "/about", "/disclaimer"];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    changeFrequency: route === "/trends" ? "hourly" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const articleEntries: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${siteConfig.url}/articles/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...articleEntries];
}
