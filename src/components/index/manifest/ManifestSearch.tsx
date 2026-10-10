import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Filter,
  X,
  FileCode,
  Database,
  Shield,
  Server,
  Cloud,
  Container,
} from "lucide-react";

interface ManifestSearchProps {
  code: string;
  onJumpToLine?: (lineNumber: number) => void;
}

interface SearchResult {
  lineNumber: number;
  content: string;
  category: string;
}

const FILTER_CATEGORIES = [
  { id: "terraform", label: "Terraform", icon: FileCode, keywords: ["terraform", "module", "resource", "provider", "variable"] },
  { id: "kubernetes", label: "Kubernetes", icon: Container, keywords: ["kubectl", "namespace", "deployment", "service", "ingress", "pod"] },
  { id: "database", label: "Database", icon: Database, keywords: ["rds", "postgres", "database", "db_", "backup"] },
  { id: "security", label: "Security", icon: Shield, keywords: ["security", "iam", "policy", "guardduty", "cloudtrail", "kms", "encryption"] },
  { id: "networking", label: "Networking", icon: Server, keywords: ["vpc", "subnet", "cidr", "gateway", "load_balancer", "alb", "nlb"] },
  { id: "monitoring", label: "Monitoring", icon: Cloud, keywords: ["cloudwatch", "prometheus", "grafana", "alarm", "metric", "dashboard"] },
];

export function ManifestSearch({ code, onJumpToLine }: ManifestSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = useMemo(() => code.split("\n"), [code]);

  const searchResults = useMemo(() => {
    if (!searchQuery && activeFilters.length === 0) return [];

    const results: SearchResult[] = [];
    const queryLower = searchQuery.toLowerCase();

    lines.forEach((line, index) => {
      const lineLower = line.toLowerCase();
      let matches = false;
      let matchedCategory = "general";

      // Check search query
      if (searchQuery && lineLower.includes(queryLower)) {
        matches = true;
      }

      // Check category filters
      if (activeFilters.length > 0) {
        for (const category of FILTER_CATEGORIES) {
          if (activeFilters.includes(category.id)) {
            if (category.keywords.some((kw) => lineLower.includes(kw))) {
              matches = true;
              matchedCategory = category.label;
              break;
            }
          }
        }
      } else if (matches) {
        // Determine category for search results
        for (const category of FILTER_CATEGORIES) {
          if (category.keywords.some((kw) => lineLower.includes(kw))) {
            matchedCategory = category.label;
            break;
          }
        }
      }

      if (matches) {
        results.push({
          lineNumber: index + 1,
          content: line.trim().slice(0, 80) + (line.trim().length > 80 ? "..." : ""),
          category: matchedCategory,
        });
      }
    });

    return results.slice(0, 100); // Limit results
  }, [searchQuery, activeFilters, lines]);

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]
    );
  };

  const clearAll = () => {
    setSearchQuery("");
    setActiveFilters([]);
  };

  const handleResultClick = (lineNumber: number) => {
    if (onJumpToLine) {
      onJumpToLine(lineNumber);
    }
    // Scroll to the line in the code display
    const lineElement = document.querySelector(`[data-line="${lineNumber}"]`);
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      lineElement.classList.add("bg-primary/20");
      setTimeout(() => lineElement.classList.remove("bg-primary/20"), 2000);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Manifest
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for configurations, resources, variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {(searchQuery || activeFilters.length > 0) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={clearAll}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Category Filters */}
        {isExpanded && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filter:
            </span>
            {FILTER_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeFilters.includes(category.id);
              return (
                <Badge
                  key={category.id}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => toggleFilter(category.id)}
                >
                  <Icon className="h-3 w-3" />
                  {category.label}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
              </span>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {searchResults.map((result, idx) => (
                  <button
                    key={`${result.lineNumber}-${idx}`}
                    onClick={() => handleResultClick(result.lineNumber)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <span className="text-xs text-muted-foreground font-mono min-w-[50px]">
                      L{result.lineNumber}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {result.category}
                    </Badge>
                    <span className="text-sm font-mono truncate flex-1">
                      {result.content}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* No results message */}
        {(searchQuery || activeFilters.length > 0) && searchResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No matching configurations found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
