import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

const routes = ["", "/outlook", "/trends", "/insights", "/articles", "/calculator", "/about", "/disclaimer"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    changeFrequency: route === "/trends" ? "hourly" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
