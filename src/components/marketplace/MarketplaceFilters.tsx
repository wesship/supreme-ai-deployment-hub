import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { AgentCategory, AgentPricingModel, MarketplaceFilters as FilterType } from '@/types/marketplace';
import { getCategoryIcon, getCategoryLabel } from '@/data/mockAgentTemplates';

interface MarketplaceFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

const categories: AgentCategory[] = ['security', 'infrastructure', 'automation', 'analytics', 'integration', 'custom'];
const pricingModels: { value: AgentPricingModel; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'one-time', label: 'One-time' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'usage-based', label: 'Usage-based' },
  { value: 'contact-sales', label: 'Contact' },
];

const sortOptions: { value: FilterType['sortBy']; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({ filters, onFiltersChange }) => {
  const activeFilterCount = [
    filters.category,
    filters.pricing,
    filters.minRating,
    filters.search,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({ sortBy: filters.sortBy });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          aria-label="Search marketplace agents"
          placeholder="Search agents..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={!filters.category ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, category: undefined })}
          className="text-xs"
        >
          All Categories
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={filters.category === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFiltersChange({
              ...filters,
              category: filters.category === category ? undefined : category,
            })}
            className="text-xs"
          >
            <span className="mr-1">{getCategoryIcon(category)}</span>
            {getCategoryLabel(category)}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Pricing:</span>
          <div className="flex flex-wrap gap-1">
            {pricingModels.map((pricing) => (
              <Badge
                key={pricing.value}
                variant={filters.pricing === pricing.value ? 'default' : 'outline'}
                className="cursor-pointer text-xs hover:bg-primary/20"
                onClick={() => onFiltersChange({
                  ...filters,
                  pricing: filters.pricing === pricing.value ? undefined : pricing.value,
                })}
              >
                {pricing.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="marketplace-sort" className="text-xs text-muted-foreground">Sort by:</label>
          <select
            id="marketplace-sort"
            value={filters.sortBy || 'popular'}
            onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as FilterType['sortBy'] })}
            className="text-xs bg-background border border-border rounded-md px-2 py-1 focus:border-primary/50 focus:outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>
    </div>
  );
};

export default MarketplaceFilters;
