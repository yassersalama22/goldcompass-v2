import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "GoldCompass provides educational information only and not financial advice. Read our full disclaimer covering market signals, third-party data, and investment risk.",
  alternates: { canonical: "/disclaimer" },
};

const LAST_UPDATED = "June 23, 2026";

export default function DisclaimerPage() {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Disclaimer</h1>
        <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="mt-8 space-y-8 text-sm leading-relaxed sm:text-base">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Educational information only</h2>
          <p className="text-muted-foreground">
            The information provided by {siteConfig.name} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;), including on this website and in any emails, is for general
            educational and informational purposes only. It does not constitute financial,
            investment, tax, accounting, or legal advice, and must not be relied upon as such.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Not financial advice or a recommendation</h2>
          <p className="text-muted-foreground">
            Nothing on this site is a recommendation, solicitation, or offer to buy or sell gold,
            securities, or any other financial instrument. Market outlooks, signals (such as
            &ldquo;buy&rdquo; or &ldquo;sell&rdquo;), price levels, and calculator outputs are
            illustrative and reflect general analysis — not personalized advice. They do not take
            into account your individual financial situation, objectives, or risk tolerance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">No advisory relationship</h2>
          <p className="text-muted-foreground">
            Using this website does not create any advisory, fiduciary, or professional
            relationship between you and {siteConfig.name}. We are not a registered investment
            adviser, broker-dealer, or financial planner. Before making any investment decision,
            you should do your own research and consult a qualified, licensed professional who can
            consider your specific circumstances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Accuracy and third-party data</h2>
          <p className="text-muted-foreground">
            Price data and market information are sourced from third parties (including, but not
            limited to, third-party price feeds) and may be delayed, inaccurate, or incomplete. We
            make no warranty as to the accuracy, completeness, or timeliness of any information on
            this site and accept no liability for errors or omissions. Always verify prices with
            your dealer or broker before transacting.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Forward-looking statements</h2>
          <p className="text-muted-foreground">
            Any outlooks, forecasts, or projections are forward-looking statements based on
            assumptions and current information, and are inherently uncertain. Actual results may
            differ materially. Past performance is not indicative of future results.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Investment risk</h2>
          <p className="text-muted-foreground">
            Gold and other precious-metal investments carry risk, including the potential loss of
            principal. Prices can be volatile and are affected by factors beyond anyone&rsquo;s
            control. Dealer premiums, storage, insurance, taxes, and buy-back spreads can
            materially affect returns. You are solely responsible for your own investment
            decisions and their outcomes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Independence</h2>
          <p className="text-muted-foreground">
            {siteConfig.name} is independent. We do not sell gold or precious metals and do not
            earn commissions on transactions you make. Where any future affiliate relationships or
            sponsorships exist, we will disclose them clearly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">External links</h2>
          <p className="text-muted-foreground">
            This site may link to third-party websites for reference. We do not control and are not
            responsible for the content, accuracy, or practices of those sites. Links do not imply
            endorsement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Changes to this disclaimer</h2>
          <p className="text-muted-foreground">
            We may update this disclaimer from time to time. Continued use of the site after changes
            are posted constitutes acceptance of the revised disclaimer.
          </p>
        </section>

        <section className="space-y-3 border-t pt-6">
          <p className="text-muted-foreground">
            Questions? Learn more {""}
            <Link href="/about" className="text-gold-strong underline underline-offset-4">
              about {siteConfig.name}
            </Link>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
