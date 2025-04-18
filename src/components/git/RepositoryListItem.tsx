
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { GitBranch, GitPullRequest, GitCommit, Trash2, RefreshCw, Check, Github } from 'lucide-react';
import { GitRepository } from '@/services/git';

interface RepositoryListItemProps {
  repo: GitRepository;
  activeRepositoryId: string | null;
  loading: boolean;
  onRepositorySelect: (repoId: string) => void;
  onPullChanges: (repo: GitRepository) => void;
  onSelectForPush: (repo: GitRepository) => void;
  onDeleteRepository: (repoId: string) => void;
}

const RepositoryListItem = ({
  repo,
  activeRepositoryId,
  loading,
  onRepositorySelect,
  onPullChanges,
  onSelectForPush,
  onDeleteRepository
}: RepositoryListItemProps) => {
  // Check if this is a GitHub repository
  const isGitHub = repo.url.includes('github.com');
  
  return (
    <Card key={repo.id} className={`border-border ${activeRepositoryId === repo.id ? 'border-primary' : ''}`}>
      <CardHeader className="py-3">
        <div className="flex justify-between items-center">
          <div className="cursor-pointer" onClick={() => onRepositorySelect(repo.id)}>
            <div className="text-base flex items-center gap-2 font-medium">
              {isGitHub ? <Github className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
              {repo.name}
            </div>
            <div className="text-xs truncate max-w-64 text-muted-foreground">
              {repo.url}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => onPullChanges(repo)}
              disabled={loading}
            >
              <GitPullRequest className="h-3 w-3 mr-2" />
              Pull
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 px-3 ${isGitHub ? "text-[#2da44e]" : ""}`}
              onClick={() => onSelectForPush(repo)}
            >
              {isGitHub ? 
                <Github className="h-3 w-3 mr-2" /> : 
                <GitCommit className="h-3 w-3 mr-2" />
              }
              Push
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => onDeleteRepository(repo.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center">
              <GitBranch className="h-3 w-3 mr-1" />
              {repo.branch}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {repo.status === 'synced' ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <RefreshCw className="h-3 w-3 text-amber-500" />
            )}
            <span>{repo.status}</span>
          </div>
          <div>
            Last synced: {repo.lastSynced ? new Date(repo.lastSynced).toLocaleString() : 'Never'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RepositoryListItem;
