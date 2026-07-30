import type { MetadataRoute } from "next";

import { INSIGHT_KINDS } from "@/config/insight-kinds";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { getAllArticles } from "@/server/articles";

const routes = [
  "",
  "/outlook",
  "/trends",
  "/insights",
  "/calculator",
  "/about",
  "/methodology",
  "/ai-disclosure",
  "/disclaimer",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    changeFrequency: route === "/trends" ? "hourly" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const insightKindEntries: MetadataRoute.Sitemap = INSIGHT_KINDS.map((kind) => ({
    url: `${siteConfig.url}${kind.href}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const toolEntries: MetadataRoute.Sitemap = TOOLS.map((tool) => ({
    url: `${siteConfig.url}${tool.href}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const articleEntries: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${siteConfig.url}/insights/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...insightKindEntries, ...toolEntries, ...articleEntries];
}
