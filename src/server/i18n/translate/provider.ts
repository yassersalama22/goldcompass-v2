import type { LocaleDef } from "@/config/locales";
import type { TranslatableField } from "@/server/i18n/field-map";

export type TranslationRequest = {
  locale: LocaleDef;
  fields: TranslatableField[];
};

export type TranslationResult = {
  /** `{ path: translatedText }`, with exactly the requested key set. */
  values: Record<string, string>;
  /** Recorded on the artifact for auditing. */
  model: string;
  promptVersion: string;
};

/**
 * Swappable translation backend, mirroring `PriceProvider`,
 * `NewsletterProvider` and the two content generators.
 *
 * The mock exists so the whole pipeline — scripts, checks, CI — runs offline
 * with no API key, the same guarantee the generators give.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
