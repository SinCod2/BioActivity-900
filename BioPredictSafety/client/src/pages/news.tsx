import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Newspaper, ExternalLink, Calendar, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  urlToImage?: string;
  category: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
}

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const { data, isLoading, error, refetch } = useQuery<NewsResponse>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/news");
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchInterval: 1000 * 60 * 60, // Refetch every hour
  });

  const filteredArticles = selectedCategory === "all" 
    ? data?.articles 
    : data?.articles?.filter(article => article.category === selectedCategory);

  const categories = [
    { value: "all", label: "All News", count: data?.articles?.length || 0 },
    { value: "Drug Approval", label: "Drug Approvals", count: data?.articles?.filter(a => a.category === "Drug Approval").length || 0 },
    { value: "Safety Alert", label: "Safety Alerts", count: data?.articles?.filter(a => a.category === "Safety Alert").length || 0 },
    { value: "Drug Information", label: "Drug Info", count: data?.articles?.filter(a => a.category === "Drug Information").length || 0 },
    { value: "Research", label: "Research", count: data?.articles?.filter(a => a.category === "Research").length || 0 },
  ];

  const parsePublishedAt = (value: string) => {
    if (!value) return null;

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) {
      const [_, year, month, day] = compact;
      const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      const epoch = value.length === 13 ? numeric : numeric * 1000;
      const parsed = new Date(epoch);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  };

  const formatDate = (dateString: string) => {
    const date = parsePublishedAt(dateString);
    if (!date) return "Recently";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-purple-500/10 text-primary shadow-[0_0_32px_-12px_rgba(59,130,246,0.5)]">
                <Newspaper className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-3xl font-bold">Research News</h1>
                <p className="text-sm text-muted-foreground">
                  Latest discoveries in bioactivity, chemistry, and drug development
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="rounded-full"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {data && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                {data.totalResults} articles from FDA OpenAPI • Live updates
              </span>
            </div>
          )}
        </div>

        {/* Category Filter */}
        {data && data.articles && data.articles.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.value)}
                className="rounded-full"
                disabled={category.count === 0}
              >
                {category.label}
                {category.count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className={`ml-2 ${selectedCategory === category.value ? "bg-primary-foreground/20" : "bg-primary/10"}`}
                  >
                    {category.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load news articles. Please try again later.
            </AlertDescription>
          </Alert>
        )}

        {/* News Grid */}
        {filteredArticles && filteredArticles.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article, index) => (
              <Card
                key={index}
                className="group relative overflow-hidden border-border/60 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_rgba(59,130,246,0.3)]"
              >
                {article.urlToImage && (
                  <div className="relative h-48 w-full overflow-hidden bg-muted">
                    <img
                      src={article.urlToImage}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  </div>
                )}

                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${
                        article.category === "Drug Approval"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : article.category === "Safety Alert"
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          : article.category === "Drug Information"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : article.category === "Research"
                          ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {article.category}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.publishedAt)}
                    </div>
                  </div>

                  <CardTitle className="line-clamp-2 text-base leading-snug group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>

                  <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                    {article.description || "No description available"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {article.source}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl transition-all hover:border-primary/50 hover:bg-primary/10"
                    asChild
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      Read Full Article
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {data && (!filteredArticles || filteredArticles.length === 0) && (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Newspaper className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No articles found</h3>
            <p className="text-sm text-muted-foreground">
              Check back later for the latest news in bioactivity and chemistry research.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
