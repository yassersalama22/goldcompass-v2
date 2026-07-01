"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "success" | "error";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Minimal typing for the Turnstile global (we load the script raw, no SDK).
type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
      action?: string;
    },
  ) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring";

export function SubscribeForm({
  source = "website",
  className,
}: {
  source?: string;
  className?: string;
}) {
  const emailId = useId();
  const statusId = useId();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Render the Turnstile widget once the script is ready (explicit mode). Only
  // when a site key is configured — otherwise the check is inert server-side.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const interval = setInterval(() => {
      if (window.turnstile && widgetRef.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "newsletter",
          theme: "auto",
          callback: (t) => setToken(t),
          "error-callback": () => setToken(null),
          "expired-callback": () => setToken(null),
        });
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source, turnstileToken: token }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setStatus("success");
        setMessage(
          data.status === "already_subscribed"
            ? "You're already on the list — thanks!"
            : "You're subscribed! Check your inbox to confirm."
        );
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.message ?? "Something went wrong. Please try again.");
        // One-time tokens are consumed on use — reset for a retry.
        window.turnstile?.reset(widgetId.current ?? undefined);
        setToken(null);
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
      window.turnstile?.reset(widgetId.current ?? undefined);
      setToken(null);
    }
  }

  if (status === "success") {
    return (
      <p
        id={statusId}
        role="status"
        className={cn("flex items-start gap-2 text-sm text-bull", className)}
      >
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
    );
  }

  const awaitingToken = Boolean(TURNSTILE_SITE_KEY) && !token;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-2", className)} noValidate>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          aria-describedby={message ? statusId : undefined}
          aria-invalid={status === "error"}
          className={cn(inputClass, "sm:flex-1")}
        />

        {/* Honeypot — visually hidden, ignored by humans, off the a11y tree. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={`${emailId}-company`}>Company (leave blank)</label>
          <input
            id={`${emailId}-company`}
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          disabled={status === "loading" || awaitingToken}
          className="shrink-0"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Subscribing…
            </>
          ) : (
            "Subscribe"
          )}
        </Button>
      </div>

      {/* Cloudflare Turnstile widget (rendered into by the script, if configured) */}
      {TURNSTILE_SITE_KEY && <div ref={widgetRef} className="min-h-[65px]" />}

      {/* Status / error live region (success handled above) */}
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={cn("text-xs", status === "error" ? "text-bear" : "sr-only")}
      >
        {status === "error" ? message : ""}
      </p>
    </form>
  );
}
