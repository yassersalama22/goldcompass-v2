import { ArrowRight, BookOpen, Clock, Newspaper } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Article {
  id: string
  title: string
  summary: string
  category: string
  readTime: string
  date: string
  imageUrl: string
  imageAlt: string
}

// Calming, lifestyle / nature imagery — intentionally avoiding aggressive
// trading-chart visuals. Replace with editorial assets once available.
const ARTICLES: Article[] = [
  {
    id: 'safe-haven-2026',
    title: 'Why gold is a safe haven in 2026',
    summary:
      'Three quiet forces — currency drift, central bank demand, and inflation — explain why investors are returning to gold this year.',
    category: 'Education',
    readTime: '4 min read',
    date: 'May 12, 2026',
    imageUrl:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70',
    imageAlt: 'Sunlit rolling fields at dusk',
  },
  {
    id: 'allocation-basics',
    title: 'How much gold belongs in a balanced portfolio?',
    summary:
      'A plainspoken framework for sizing your position — without overcomplicating things or chasing headlines.',
    category: 'Strategy',
    readTime: '6 min read',
    date: 'May 8, 2026',
    imageUrl:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=70',
    imageAlt: 'A calm mountain lake reflecting the sky',
  },
  {
    id: 'beginner-mistakes',
    title: 'Five beginner mistakes when buying gold',
    summary:
      'From premiums to storage, the small decisions that quietly eat into your long-term returns — and how to avoid them.',
    category: 'Beginner',
    readTime: '5 min read',
    date: 'May 1, 2026',
    imageUrl:
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=70',
    imageAlt: 'A misty forest path winding into the distance',
  },
]

function ArticleCard({ article }: { article: Article }) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={article.imageUrl}
          alt={article.imageAlt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3">
          <Badge variant="brand">{article.category}</Badge>
        </div>
      </div>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{article.date}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {article.readTime}
          </span>
        </div>
        <CardTitle className="text-balance text-lg leading-snug">
          {article.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          variant="link"
          className="h-auto p-0 text-sm font-semibold"
        >
          <a href={`#article-${article.id}`} aria-label={`Read more: ${article.title}`}>
            Read more
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

export function MarketInsights() {
  return (
    <section
      id="insights"
      aria-labelledby="insights-title"
      className="scroll-mt-20"
    >
      <div className="container py-14 sm:py-16 lg:py-20">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="brand" className="mb-3">
              <Newspaper className="h-3 w-3" />
              Insights & News
            </Badge>
            <h2
              id="insights-title"
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Market Insights & News
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Short, plainspoken explainers from our team — written for
              everyday investors, not Wall Street.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="#archive" className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              Browse all articles
            </a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  )
}
