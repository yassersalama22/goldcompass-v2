import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Insights and Articles were merged into one hub (/insights). Permanently
    // redirect the old /articles routes so links and search rankings carry over.
    return [
      { source: "/articles", destination: "/insights", permanent: true },
      { source: "/articles/rss.xml", destination: "/insights/rss.xml", permanent: true },
      { source: "/articles/:slug", destination: "/insights/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
