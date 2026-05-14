import { Anchor, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Investment Compass', href: '#compass' },
      { label: 'Price Trends', href: '#trends' },
      { label: 'Insights', href: '#insights' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Methodology', href: '#about' },
      { label: 'Contact', href: 'mailto:hello@goldcompass.example' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Disclaimer', href: '#disclaimer' },
      { label: 'Privacy', href: '#privacy' },
      { label: 'Terms', href: '#terms' },
    ],
  },
] as const

const DISCLAIMER_TEXT =
  "The website's objective is to provide consultative opinions. Please be advised that all opinions presented are for informational purposes only and do not constitute legal obligation or responsibility whatsoever on the part of the authors. Users must acknowledge and take any subsequent actions at their own risk."

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12">
        <div id="disclaimer" className="scroll-mt-20">
          <Alert variant="muted">
            <Info className="h-4 w-4" />
            <AlertTitle>Important disclaimer</AlertTitle>
            <AlertDescription>{DISCLAIMER_TEXT}</AlertDescription>
          </Alert>
        </div>

        <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr,1fr,1fr,1fr]">
          <div className="space-y-3">
            <a href="#top" className="inline-flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-lg bg-nautical-700 text-white shadow-soft"
              >
                <Anchor className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <span className="text-base font-semibold tracking-tight text-foreground">
                GoldCompass
              </span>
            </a>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Plainspoken, jargon-free gold investment guidance for everyday
              investors. We help you steer with confidence.
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-foreground/80 transition-colors hover:text-nautical-700"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>&copy; {year} GoldCompass. All rights reserved.</p>
          <p className="max-w-2xl leading-relaxed">
            Not investment advice. Past performance is not a reliable indicator
            of future results.
          </p>
        </div>
      </div>
    </footer>
  )
}
