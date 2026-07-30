/**
 * The gold tool hub. Single source of truth for the sibling-tool sidebar, the
 * `/calculator` hub section, and `sitemap.ts` — add a tool here and it appears
 * in all three. `href` is also the canonical path, so it must match the route.
 */

export interface ToolDef {
  slug: string;
  href: string;
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
  name: "Smart Gold Calculator",
  shortName: "Smart Gold Calculator",
  description:
    "Budget, purity, and dealer premium in — quantity, break-even, and profit/loss scenarios out.",
};

export const TOOLS: ToolDef[] = [
  {
    slug: "gold-karat-price",
    href: "/calculator/gold-karat-price",
    name: "Gold Karat Price Calculator",
    shortName: "Karat price",
    description:
      "What 10K, 14K, 18K, 22K, and 24K gold is worth per gram and per troy ounce at today's spot price.",
  },
  {
    slug: "gold-unit-converter",
    href: "/calculator/gold-unit-converter",
    name: "Gold Unit Converter",
    shortName: "Unit converter",
    description:
      "Convert gold weights between grams, kilograms, troy ounces, ounces, pennyweight, and tola — with the value of each.",
  },
  {
    slug: "gold-break-even",
    href: "/calculator/gold-break-even",
    name: "Gold Break-Even Calculator",
    shortName: "Break-even",
    description:
      "How far the gold price has to rise before a purchase at a given dealer premium returns your money.",
  },
  {
    slug: "gold-profit-loss",
    href: "/calculator/gold-profit-loss",
    name: "Gold Profit & Loss Calculator",
    shortName: "Profit & loss",
    description:
      "Entry price, exit price, and quantity in — profit or loss in dollars and percent, after buying and selling costs.",
  },
];

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Every tool except the given one, for the "other tools" sidebar. */
export function siblingTools(slug: string): ToolDef[] {
  return TOOLS.filter((t) => t.slug !== slug);
}
