import { ImageResponse } from "next/og";

import { ACTIVE_LOCALES } from "@/config/locales";

import { BrandCard, OG_SIZE, OG_TAGLINE } from "@/lib/og";

// Site-wide default Open Graph image (deeper segments override with their own).
export const alt = "GoldCompass — Smart Gold Investing Guidance";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Keeps the card prerendered per locale. A metadata image under a dynamic
 * segment is otherwise generated on demand, and rendering a PNG through satori
 * on every crawler/social-scraper request is expensive on a 1GB instance.
 */
export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale: locale.code }));
}


export default function OpengraphImage() {
  return new ImageResponse(<BrandCard tagline={OG_TAGLINE} />, size);
}
