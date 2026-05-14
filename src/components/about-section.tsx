import { GraduationCap, Shield, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PILLARS = [
  {
    icon: Shield,
    title: 'Independent & objective',
    body: 'We are not a broker. Our recommendations are not paid placements — just an honest read of the data.',
  },
  {
    icon: GraduationCap,
    title: 'Built for everyday investors',
    body: 'No jargon, no acronyms, no endless caveats. Just what to do, why, and how confident we are.',
  },
  {
    icon: Sparkles,
    title: 'Transparent methodology',
    body: 'Every recommendation links back to the indicators behind it, so you can decide what fits your goals.',
  },
] as const

export function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="scroll-mt-20 border-t border-border bg-muted/30"
    >
      <div className="container py-14 sm:py-16 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <Badge variant="brand" className="mb-3">
              <Shield className="h-3 w-3" />
              About GoldCompass
            </Badge>
            <h2
              id="about-title"
              className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
            >
              We provide everyday investors with clear, jargon-free gold
              investment guidance.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              GoldCompass was built on a simple idea: serious investing should
              not require a finance degree. We watch the markets, distill the
              signal, and deliver a clear point of view — so you can make
              decisions with confidence and clarity.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Whether you are protecting savings, diversifying a retirement
              plan, or buying your first gram, our role is to be a steady,
              trustworthy guide.
            </p>
          </div>

          <div className="grid gap-4">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border-border">
                <CardContent className="flex gap-4 p-5 sm:p-6">
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-nautical-50 text-nautical-700"
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
