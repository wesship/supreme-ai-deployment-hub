import React from 'react';
import { Search, Calendar, Tag, GitBranch, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch as Branch } from '@/services/git';

export type CommitFilterOptions = {
  searchQuery: string;
  branch: string | null;
  author: string | null;
  dateRange: 'all' | 'today' | 'week' | 'month';
};

interface CommitFilterProps {
  filterOptions: CommitFilterOptions;
  branches: Branch[];
  authors: string[];
  onFilterChange: (newFilters: Partial<CommitFilterOptions>) => void;
  onClearFilters: () => void;
}

const CommitFilter: React.FC<CommitFilterProps> = ({
  filterOptions,
  branches,
  authors,
  onFilterChange,
  onClearFilters
}) => {
  return (
    <div className="p-2 bg-muted/20 rounded-md mb-4">
      <div className="text-sm font-medium mb-2 flex items-center">
        <Filter className="h-4 w-4 mr-2" />
        Filter Commits
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* Search query */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commits..."
            value={filterOptions.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="pl-8"
          />
        </div>
        
        {/* Branch filter */}
        <div>
          <Select
            value={filterOptions.branch || ''}
            onValueChange={(value) => onFilterChange({ branch: value || null })}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center">
                <GitBranch className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Branch" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Branches</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Author filter */}
        <div>
          <Select
            value={filterOptions.author || ''}
            onValueChange={(value) => onFilterChange({ author: value || null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Author" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Authors</SelectItem>
              {authors.map(author => (
                <SelectItem key={author} value={author}>
                  {author}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Date range filter */}
        <div>
          <Select
            value={filterOptions.dateRange}
            onValueChange={(value) => onFilterChange({ dateRange: value as 'all' | 'today' | 'week' | 'month' })}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Time Range" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="mt-2 flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
};

export default CommitFilter;
