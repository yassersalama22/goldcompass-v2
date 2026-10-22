import { messages } from "@/i18n/messages";

/**
 * The gold tool hub. Single source of truth for the sibling-tool sidebar, the
 * `/calculator` hub section, and `sitemap.ts` — add a tool here and it appears
 * in all three. `href` is also the canonical path, so it must match the route.
 *
 * Structure only. Names and descriptions live in the UI catalog under
 * `tools.<messageKey>` so they are translatable; read them with `toolCopy()`.
 */

export interface ToolDef {
  slug: string;
  href: string;
  /** Key under `tools.*` in the UI catalog. */
  messageKey: "flagship" | "goldKaratPrice" | "goldUnitConverter" | "goldBreakEven" | "goldProfitLoss";
}

export interface ToolCopy {
  /** Full name — used as the <h1>, the JSON-LD name, and the title tag. */
  name: string;
  /** Compact label for the sidebar and breadcrumb trail. */
  shortName: string;
  /** One line — meta description, card copy, JSON-LD description. */
  description: string;
}

/** The combined calculator stays the flagship; the tools below are its siblings. */
export const FLAGSHIP_TOOL: ToolDef = {
  slug: "calculator",
  href: "/calculator",
  messageKey: "flagship",
};

export const TOOLS: ToolDef[] = [
  { slug: "gold-karat-price", href: "/calculator/gold-karat-price", messageKey: "goldKaratPrice" },
  { slug: "gold-unit-converter", href: "/calculator/gold-unit-converter", messageKey: "goldUnitConverter" },
  { slug: "gold-break-even", href: "/calculator/gold-break-even", messageKey: "goldBreakEven" },
  { slug: "gold-profit-loss", href: "/calculator/gold-profit-loss", messageKey: "goldProfitLoss" },
];

/**
 * A tool's name, short name and description in one locale. Sync (via
 * `messages()`) because the Markdown builder, `llms.txt` and the JSON-LD
 * builders run outside a React render.
 */
export function toolCopy(def: ToolDef, locale: string): ToolCopy {
  const { name, shortName, description } = messages(locale).tools[def.messageKey];
  return { name, shortName, description };
}

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Every tool except the given one, for the "other tools" sidebar. */
export function siblingTools(slug: string): ToolDef[] {
  return TOOLS.filter((t) => t.slug !== slug);
}
