"use client";

import { useId, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "success" | "error";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source }),
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
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
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

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-2", className)} noValidate>
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

        <Button type="submit" disabled={status === "loading"} className="shrink-0">
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
