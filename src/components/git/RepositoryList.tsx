
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { GitRepository } from '@/services/git';
import RepositoryListItem from './RepositoryListItem';

interface RepositoryListProps {
  repositories: GitRepository[];
  activeRepositoryId: string | null;
  loading: boolean;
  onRepositorySelect: (repoId: string) => void;
  onPullChanges: (repo: GitRepository) => void;
  onSelectForPush: (repo: GitRepository) => void;
  onDeleteRepository: (repoId: string) => void;
}

const RepositoryList = ({
  repositories,
  activeRepositoryId,
  loading,
  onRepositorySelect,
  onPullChanges,
  onSelectForPush,
  onDeleteRepository
}: RepositoryListProps) => {
  if (repositories.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No repositories</AlertTitle>
        <AlertDescription>
          You haven't added any Git repositories yet. Click "Add Repository" to get started.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {repositories.map((repo) => (
        <RepositoryListItem
          key={repo.id}
          repo={repo}
          activeRepositoryId={activeRepositoryId}
          loading={loading}
          onRepositorySelect={onRepositorySelect}
          onPullChanges={onPullChanges}
          onSelectForPush={onSelectForPush}
          onDeleteRepository={onDeleteRepository}
        />
      ))}
    </div>
  );
};

export default RepositoryList;
