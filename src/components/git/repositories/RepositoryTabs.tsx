
import React from 'react';
import { Search, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RepositorySection from './RepositorySection';
import EmptyRepositoryState from './EmptyRepositoryState';
import GitDocumentation from '../GitDocumentation';
import { GitRepository } from '@/services/git';

interface RepositoryTabsProps {
  repositories: GitRepository[];
  filteredRepositories: GitRepository[];
  activeRepositoryId: string | null;
  loading: boolean;
  activeRepository: GitRepository | undefined;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRepositorySelect: (repoId: string) => void;
  onPullChanges: (repo: GitRepository) => void;
  onSelectForPush: (repo: GitRepository) => void;
  onDeleteRepository: (repoId: string) => void;
  onUpdateRepository: (repo: GitRepository) => void;
  onAddRepository?: () => void;
}

const RepositoryTabs: React.FC<RepositoryTabsProps> = ({
  repositories,
  filteredRepositories,
  activeRepositoryId,
  loading,
  activeRepository,
  searchQuery,
  onSearchChange,
  onRepositorySelect,
  onPullChanges,
  onSelectForPush,
  onDeleteRepository,
  onUpdateRepository,
  onAddRepository
}) => {
  return (
    <Tabs defaultValue="repositories">
      <TabsList className="mb-4">
        <TabsTrigger value="repositories">Repositories</TabsTrigger>
        <TabsTrigger value="documentation" className="flex items-center gap-1">
          <HelpCircle className="h-4 w-4" />
          Documentation
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="repositories">
        <div className="mb-4 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        
        {filteredRepositories.length === 0 && repositories.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No repositories match your search criteria
          </div>
        )}
        
        {repositories.length === 0 && <EmptyRepositoryState onAddRepository={onAddRepository} />}
        
        <RepositorySection
          repositories={filteredRepositories}
          activeRepositoryId={activeRepositoryId}
          loading={loading}
          activeRepository={activeRepository}
          onRepositorySelect={onRepositorySelect}
          onPullChanges={onPullChanges}
          onSelectForPush={onSelectForPush}
          onDeleteRepository={onDeleteRepository}
          onUpdateRepository={onUpdateRepository}
        />
      </TabsContent>
      
      <TabsContent value="documentation">
        <GitDocumentation />
      </TabsContent>
    </Tabs>
  );
};

export default RepositoryTabs;
