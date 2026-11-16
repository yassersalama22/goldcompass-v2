"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { linkTag } from "@/i18n/rich";
import { consentController, type ConsentState } from "@/lib/analytics";

const noop = () => () => {};

function subscribe(listener: () => void) {
  return consentController()?.subscribe(listener) ?? noop();
}
const getSnapshot = (): ConsentState => consentController()?.getState() ?? "pending";
// The server (and the hydrating render) never knows the visitor's consent, so
// both render nothing: no hydration mismatch, and edge-cached HTML carries no
// per-visitor state.
const getServerSnapshot = (): ConsentState => "pending";

/** Set by `openConsentSettings()` so the banner knows to take focus. */
let returnFocusTo: HTMLElement | null = null;
/** The state before re-opening: a `free` visitor has no stored choice but IS
 *  being measured, and the banner should say so. */
let stateBeforeOpen: ConsentState | null = null;

/** Re-open the banner from a "Cookie settings" control. */
export function openConsentSettings(trigger?: HTMLElement | null) {
  const controller = consentController();
  returnFocusTo = trigger ?? null;
  stateBeforeOpen = controller?.getState() ?? null;
  controller?.open();
}

/**
 * The analytics consent prompt.
 *
 * Shown automatically only where consent is required (EEA/UK/CH — the region
 * logic lives in the bootstrap, `lib/analytics.ts`), and to anyone who opens it
 * from the footer. It is a non-modal region at the bottom of the viewport, not
 * a dialog: the page stays fully usable, and not choosing means not tracked.
 *
 * Accept and Decline are the same size and style, one click each — declining
 * must be as easy as accepting (EDPB cookie-banner guidance), and a brighter
 * "Accept" is the kind of nudge regulators cite.
 *
 * Focus is moved here only when the visitor opened it themselves; appearing on
 * page load does not steal focus from whatever they were doing.
 */
export function ConsentBanner() {
  const t = useTranslations("consent");
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const headingId = useId();
  const regionRef = useRef<HTMLElement>(null);
  const visible = state === "ask";

  useEffect(() => {
    if (visible && returnFocusTo) regionRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const choice =
    consentController()?.getChoice() ??
    (stateBeforeOpen === "free" ? "granted" : null);

  const decide = (grant: boolean) => {
    const controller = consentController();
    if (grant) controller?.grant();
    else controller?.deny();
    returnFocusTo?.focus();
    returnFocusTo = null;
    stateBeforeOpen = null;
  };

  return (
    <section
      ref={regionRef}
      data-consent-banner=""
      tabIndex={-1}
      aria-labelledby={headingId}
      className="bg-background fixed inset-x-4 bottom-4 z-50 rounded-xl border p-4 shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:inset-x-auto sm:end-4 sm:max-w-sm"
    >
      <h2 id={headingId} className="text-sm font-semibold">
        {t("heading")}
      </h2>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {t.rich("body", { privacy: linkTag("/privacy") })}
      </p>
      {choice ? (
        <p className="text-muted-foreground mt-2 text-xs">
          {t(choice === "granted" ? "currentGranted" : "currentDenied")}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => decide(false)}>
          {t("decline")}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => decide(true)}>
          {t("accept")}
        </Button>
      </div>
    </section>
  );
}

/** Footer control that re-opens the banner. Rendered only when GA is configured. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => openConsentSettings(event.currentTarget)}
    >
      {t("settings")}
    </button>
  );
}
