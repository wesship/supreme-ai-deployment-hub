
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { GitBranch, GitCommit as GitCommitIcon, GitFork, GitMerge, GitPullRequest, GitCompare, GitCommitHorizontal, List, GitGraph } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitCommit as Commit, GitRepository, GitBranch as Branch } from '@/services/git';
import CommitGraph from './CommitGraph';
import CommitFilter, { CommitFilterOptions } from './CommitFilter';

interface CommitHistoryViewProps {
  repository: GitRepository;
  commits: Commit[];
  branches: Branch[];
  loading: boolean;
  onLoadMore: () => void;
  onCommitSelect: (commit: Commit) => void;
  selectedCommitHash?: string;
}

export const CommitHistoryView = ({ 
  repository, 
  commits,
  branches,
  loading, 
  onLoadMore, 
  onCommitSelect,
  selectedCommitHash
}: CommitHistoryViewProps) => {
  // State for view mode
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  
  // Filter state
  const [filterOptions, setFilterOptions] = useState<CommitFilterOptions>({
    searchQuery: '',
    branch: null,
    author: null,
    dateRange: 'all'
  });
  
  // Get unique authors from commits
  const authors = [...new Set(commits.map(commit => commit.author))];
  
  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<CommitFilterOptions>) => {
    setFilterOptions(prev => ({ ...prev, ...newFilters }));
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setFilterOptions({
      searchQuery: '',
      branch: null,
      author: null,
      dateRange: 'all'
    });
  };
  
  // Apply filters to commits
  const filteredCommits = commits.filter(commit => {
    // Text search filter
    if (filterOptions.searchQuery && 
        !commit.message.toLowerCase().includes(filterOptions.searchQuery.toLowerCase()) &&
        !commit.hash.includes(filterOptions.searchQuery) &&
        !commit.shortHash.includes(filterOptions.searchQuery) &&
        !commit.author.toLowerCase().includes(filterOptions.searchQuery.toLowerCase())) {
      return false;
    }
    
    // Branch filter
    if (filterOptions.branch && commit.branch !== filterOptions.branch) {
      return false;
    }
    
    // Author filter
    if (filterOptions.author && commit.author !== filterOptions.author) {
      return false;
    }
    
    // Date filter
    if (filterOptions.dateRange !== 'all') {
      const commitDate = new Date(commit.date);
      const today = new Date();
      
      if (filterOptions.dateRange === 'today') {
        if (commitDate.getDate() !== today.getDate() || 
            commitDate.getMonth() !== today.getMonth() || 
            commitDate.getFullYear() !== today.getFullYear()) {
          return false;
        }
      } else if (filterOptions.dateRange === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 7);
        if (commitDate < oneWeekAgo) {
          return false;
        }
      } else if (filterOptions.dateRange === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);
        if (commitDate < oneMonthAgo) {
          return false;
        }
      }
    }
    
    return true;
  });

  return (
    <Card className="w-full h-full shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitCommitHorizontal className="h-5 w-5" />
              Commit History
            </CardTitle>
            <CardDescription>
              {repository.name} ({repository.branch})
            </CardDescription>
          </div>
          
          <div>
            <TabsList>
              <TabsTrigger 
                value="list" 
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </TabsTrigger>
              <TabsTrigger 
                value="graph" 
                onClick={() => setViewMode('graph')}
                className={viewMode === 'graph' ? 'bg-primary text-primary-foreground' : ''}
              >
                <GitGraph className="h-4 w-4 mr-2" />
                Graph
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* Filters */}
        <CommitFilter
          filterOptions={filterOptions}
          branches={branches}
          authors={authors}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
        
        {/* View modes */}
        {viewMode === 'graph' ? (
          <CommitGraph
            commits={filteredCommits}
            branches={branches}
            onCommitSelect={onCommitSelect}
            selectedCommitHash={selectedCommitHash}
          />
        ) : (
          <ListView 
            commits={filteredCommits} 
            loading={loading} 
            onLoadMore={onLoadMore} 
            onCommitSelect={onCommitSelect}
            selectedCommitHash={selectedCommitHash}
          />
        )}
      </CardContent>
    </Card>
  );
};

interface ListViewProps {
  commits: Commit[];
  loading: boolean;
  onLoadMore: () => void;
  onCommitSelect: (commit: Commit) => void;
  selectedCommitHash?: string;
}

const ListView: React.FC<ListViewProps> = ({ commits, loading, onLoadMore, onCommitSelect, selectedCommitHash }) => {
  return (
    <ScrollArea className="h-[500px] rounded-md">
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-border"></div>
        
        <div className="space-y-1 p-1">
          {loading && commits.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <CommitSkeleton key={i} />
            ))
          ) : commits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No commits match your filter criteria
            </div>
          ) : (
            commits.map((commit) => (
              <CommitItem 
                key={commit.id} 
                commit={commit} 
                onClick={() => onCommitSelect(commit)}
                isSelected={commit.hash === selectedCommitHash}
              />
            ))
          )}
          
          {commits.length > 0 && (
            <div className="flex justify-center py-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

interface CommitItemProps {
  commit: Commit;
  onClick: () => void;
  isSelected?: boolean;
}

const CommitItem = ({ commit, onClick, isSelected }: CommitItemProps) => {
  const authorInitials = commit.author
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase();
  
  // Determine if commit is a merge
  const isMerge = commit.message.startsWith('Merge');
  
  return (
    <div 
      className={`flex items-start p-3 rounded-md transition-colors relative cursor-pointer ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
      onClick={onClick}
    >
      <div className="relative z-10 mr-4">
        {isMerge ? (
          <div className="bg-blue-500 text-white p-1 rounded-full">
            <GitMerge className="h-4 w-4" />
          </div>
        ) : (
          <div className="bg-primary text-primary-foreground p-1 rounded-full">
            <GitCommitIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{commit.message}</p>
          {commit.tags?.map(tag => (
            <Badge key={tag} variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="font-mono">{commit.shortHash}</span>
          <span>•</span>
          <span>{format(new Date(commit.date), 'MMM d, yyyy HH:mm')}</span>
          {commit.branch && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {commit.branch}
              </span>
            </>
          )}
        </div>
      </div>
      
      <Avatar className="h-6 w-6 ml-2">
        <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
      </Avatar>
    </div>
  );
};

const CommitSkeleton = () => (
  <div className="flex items-start p-3 relative">
    <div className="relative z-10 mr-4">
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
    <div className="flex-1">
      <Skeleton className="h-5 w-full max-w-[250px] mb-2" />
      <Skeleton className="h-3 w-[160px]" />
    </div>
  </div>
);

export default CommitHistoryView;
