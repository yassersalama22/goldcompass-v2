import type { LocaleDef } from "@/config/locales";
import type { TranslatableField } from "@/server/i18n/field-map";

export type TranslationRequest = {
  locale: LocaleDef;
  fields: TranslatableField[];
  /**
   * Every number must survive exactly — the artifact rule in `i18n:check`.
   * When set, a provider that can repair its output (the Claude one) re-asks
   * for any field whose numbers changed before returning. Left unset for UI
   * catalogs, whose gate allows small round numbers to be spelled as words and
   * whose ICU plural branches legitimately carry different digits per language.
   */
  exactNumerals?: boolean;
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
