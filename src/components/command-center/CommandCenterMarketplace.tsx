import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, Search, Star, Download, Zap } from "lucide-react";

interface Props {
  onNavigate: (view: string) => void;
}

const SAMPLE_TEMPLATES = [
  { name: "Code Review Agent", category: "Development", rating: 4.8, downloads: 1200, tags: ["code", "review", "quality"] },
  { name: "Data Pipeline Agent", category: "Data", rating: 4.5, downloads: 890, tags: ["etl", "data", "automation"] },
  { name: "Customer Support Bot", category: "Support", rating: 4.7, downloads: 2300, tags: ["chat", "support", "nlp"] },
  { name: "SEO Optimizer", category: "Marketing", rating: 4.3, downloads: 650, tags: ["seo", "content", "web"] },
  { name: "Security Scanner", category: "Security", rating: 4.9, downloads: 1800, tags: ["security", "audit", "scan"] },
  { name: "DevOps Deployer", category: "Infrastructure", rating: 4.6, downloads: 1100, tags: ["deploy", "ci/cd", "docker"] },
];

export default function CommandCenterMarketplace({ onNavigate }: Props) {
  const [search, setSearch] = useState("");

  const filtered = SAMPLE_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Marketplace</h2>
          <p className="text-muted-foreground mt-1">Browse and deploy pre-built agent templates</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <Card key={template.name} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {template.rating}
                </div>
              </div>
              <CardTitle className="text-base mt-2">{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Download className="h-3 w-3" /> {template.downloads.toLocaleString()}
                </span>
                <Button size="sm">
                  <Zap className="h-3 w-3 mr-1" /> Deploy
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No templates match your search.</p>
        </div>
      )}
    </div>
  );
}
