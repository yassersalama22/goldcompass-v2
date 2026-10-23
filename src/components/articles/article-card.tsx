import { useLocale } from "next-intl";

import { Link } from "@/i18n/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMediumDate } from "@/lib/format";
import { isArticleTranslated } from "@/server/articles";
import { contentLangProps } from "@/server/i18n/availability";
import type { ArticleSummary } from "@/types/article";

export function ArticleCard({ article }: { article: ArticleSummary }) {
  const locale = useLocale();
  // Per card: an archive can mix translated and fallback pieces.
  const content = contentLangProps(isArticleTranslated(article.slug, locale), locale);
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" {...content}>
            {article.category}
          </Badge>
          <time dateTime={article.date} className="text-muted-foreground text-xs">
            {formatMediumDate(article.date, locale)}
          </time>
        </div>
        <CardTitle className="mt-2 text-lg leading-snug" {...content}>
          <Link
            href={`/insights/${article.slug}`}
            className="hover:text-gold-strong after:absolute after:inset-0 focus-visible:underline"
          >
            {article.title}
          </Link>
        </CardTitle>
        <CardDescription {...content}>{article.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
