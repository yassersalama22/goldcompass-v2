import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArticleSummary } from "@/types/article";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{article.category}</Badge>
          <time dateTime={article.date} className="text-muted-foreground text-xs">
            {dateFormatter.format(new Date(article.date))}
          </time>
        </div>
        <CardTitle className="mt-2 text-lg leading-snug">
          <Link
            href={`/articles/${article.slug}`}
            className="hover:text-gold-strong after:absolute after:inset-0 focus-visible:underline"
          >
            {article.title}
          </Link>
        </CardTitle>
        <CardDescription>{article.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
