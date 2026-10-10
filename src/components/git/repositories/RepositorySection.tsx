
import React from 'react';
import { GitRepository } from '@/services/git';
import RepositoryList from '../RepositoryList';
import GitVisualization from '../GitVisualization';

interface RepositorySectionProps {
  repositories: GitRepository[];
  activeRepositoryId: string | null;
  loading: boolean;
  activeRepository: GitRepository | undefined;
  onRepositorySelect: (repoId: string) => void;
  onPullChanges: (repo: GitRepository) => void;
  onSelectForPush: (repo: GitRepository) => void;
  onDeleteRepository: (repoId: string) => void;
  onUpdateRepository: (repo: GitRepository) => void;
}

const RepositorySection: React.FC<RepositorySectionProps> = ({
  repositories,
  activeRepositoryId,
  loading,
  activeRepository,
  onRepositorySelect,
  onPullChanges,
  onSelectForPush,
  onDeleteRepository,
  onUpdateRepository
}) => {
  return (
    <>
      <RepositoryList
        repositories={repositories}
        activeRepositoryId={activeRepositoryId}
        loading={loading}
        onRepositorySelect={onRepositorySelect}
        onPullChanges={onPullChanges}
        onSelectForPush={onSelectForPush}
        onDeleteRepository={onDeleteRepository}
      />
      
      {activeRepository && (
        <GitVisualization
          repository={activeRepository}
          onUpdateRepository={onUpdateRepository}
        />
      )}
    </>
  );
};

export default RepositorySection;
