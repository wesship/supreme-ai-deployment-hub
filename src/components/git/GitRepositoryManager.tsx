
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useGitRepositories } from '@/hooks/useGitRepositories';
import { GitRepository } from '@/services/git';
import RepositoryHeader from './repositories/RepositoryHeader';
import RepositoryTabs from './repositories/RepositoryTabs';
import PushChangesDialogContainer from './repositories/PushChangesDialogContainer';
import DeleteRepositoryDialog from './repositories/DeleteRepositoryDialog';

export const GitRepositoryManager = () => {
  const {
    repositories,
    loading,
    selectedRepo,
    setSelectedRepo,
    activeRepositoryId,
    activeRepository,
    handleCloneRepository,
    handlePullChanges,
    handlePushChanges,
    handleDeleteRepository,
    handleRepositorySelect,
    handleUpdateRepository,
    handleSelectForPush
  } = useGitRepositories();
  
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const handleOpenPushDialog = (repo: GitRepository) => {
    handleSelectForPush(repo);
    setIsPushDialogOpen(true);
  };
  
  const handleClosePushDialog = () => {
    setIsPushDialogOpen(false);
    setSelectedRepo(null);
  };
  
  const handleConfirmDelete = (repoId: string) => {
    setRepoToDelete(repoId);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (repoToDelete) {
      await handleDeleteRepository(repoToDelete);
      setIsDeleteDialogOpen(false);
      setRepoToDelete(null);
    }
  };
  
  const refreshAllRepositories = async () => {
    setIsRefreshing(true);
    try {
      for (const repo of repositories) {
        await handlePullChanges(repo);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenAddDialog = () => {
    window.dispatchEvent(new Event('openAddRepoDialog'));
    setIsAddDialogOpen(true);
  };

  const filteredRepositories = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    repo.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.branch.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <RepositoryHeader
          loading={loading}
          isRefreshing={isRefreshing}
          repositoriesCount={repositories.length}
          onRefreshAll={refreshAllRepositories}
          onCloneRepository={handleCloneRepository}
          onOpenAddDialog={handleOpenAddDialog}
        />
      </CardHeader>
      <CardContent>
        <RepositoryTabs
          repositories={repositories}
          filteredRepositories={filteredRepositories}
          activeRepositoryId={activeRepositoryId}
          loading={loading}
          activeRepository={activeRepository}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRepositorySelect={handleRepositorySelect}
          onPullChanges={handlePullChanges}
          onSelectForPush={handleOpenPushDialog}
          onDeleteRepository={handleConfirmDelete}
          onUpdateRepository={handleUpdateRepository}
          onAddRepository={handleOpenAddDialog}
        />
      </CardContent>
      
      <PushChangesDialogContainer
        isOpen={isPushDialogOpen}
        onClose={handleClosePushDialog}
        selectedRepo={selectedRepo}
        loading={loading}
        onPushChanges={handlePushChanges}
      />
      
      <DeleteRepositoryDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirmDelete={confirmDelete}
      />
    </Card>
  );
};

export default GitRepositoryManager;
