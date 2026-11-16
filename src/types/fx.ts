import { z } from "zod";

import { LOCAL_CURRENCIES } from "@/config/currencies";

/**
 * Exchange rates used to show gold prices in local currencies.
 *
 * Deliberately NOT part of the public `/api/v1` contract, unlike prices and
 * outlooks: the source's terms allow using the rates to convert figures we
 * display, but not redistributing the rates themselves. So they exist only
 * inside the data-access layer and as converted figures on pages.
 */
export const fxRatesSchema = z.object({
  base: z.literal("USD"),
  /** Units of each currency per 1 USD. Only currencies we display; a currency the source omitted is simply absent. */
  rates: z.partialRecord(z.enum(LOCAL_CURRENCIES), z.number().positive()),
  /** When the source last updated the rates (ISO 8601). */
  updatedAt: z.string(),
  /** Attribution the source's terms require on every page that shows rates. */
  source: z.object({ name: z.string(), url: z.string().url() }),
});

export type FxRates = z.infer<typeof fxRatesSchema>;
