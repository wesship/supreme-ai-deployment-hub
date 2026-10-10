
import { useState, useEffect } from 'react';
import { GitRepository, gitService } from '@/services/git';
import { getRepositories, saveRepository, deleteRepository } from '@/extension/gitStorage';
import { toast } from 'sonner';

export function useGitRepositories() {
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null);
  const [activeRepositoryId, setActiveRepositoryId] = useState<string | null>(null);
  
  // Load repositories on hook initialization
  useEffect(() => {
    loadRepositories();
  }, []);
  
  const loadRepositories = async () => {
    try {
      const repos = await getRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Error loading repositories:', error);
      toast.error('Failed to load repositories');
    }
  };
  
  const handleCloneRepository = async (url: string, branch: string, token: string) => {
    if (!url) {
      toast.error('Repository URL is required');
      return false;
    }
    
    setLoading(true);
    try {
      const repository = await gitService.cloneRepository(url, branch, token);
      await saveRepository(repository);
      await loadRepositories();
      return true;
    } catch (error) {
      console.error('Error cloning repository:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const handlePullChanges = async (repository: GitRepository) => {
    setLoading(true);
    try {
      const updatedRepo = await gitService.pullChanges(repository);
      await saveRepository(updatedRepo);
      await loadRepositories();
    } catch (error) {
      console.error('Error pulling changes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePushChanges = async (repository: GitRepository, commitMessage: string) => {
    if (!commitMessage) {
      toast.error('Commit message is required');
      return false;
    }
    
    setLoading(true);
    try {
      const updatedRepo = await gitService.pushChanges(repository, commitMessage);
      await saveRepository(updatedRepo);
      await loadRepositories();
      return true;
    } catch (error) {
      console.error('Error pushing changes:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteRepository = async (repositoryId: string) => {
    if (window.confirm('Are you sure you want to delete this repository?')) {
      try {
        await deleteRepository(repositoryId);
        await loadRepositories();
        if (activeRepositoryId === repositoryId) {
          setActiveRepositoryId(null);
        }
        toast.success('Repository removed successfully');
      } catch (error) {
        console.error('Error deleting repository:', error);
        toast.error('Failed to delete repository');
      }
    }
  };
  
  const handleRepositorySelect = (repoId: string) => {
    setActiveRepositoryId(repoId === activeRepositoryId ? null : repoId);
  };
  
  const handleUpdateRepository = async (updatedRepo: GitRepository) => {
    try {
      await saveRepository(updatedRepo);
      await loadRepositories();
    } catch (error) {
      console.error('Error updating repository:', error);
    }
  };
  
  const handleSelectForPush = (repo: GitRepository) => {
    setSelectedRepo(repo);
  };
  
  const activeRepository = repositories.find(repo => repo.id === activeRepositoryId);
  
  return {
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
  };
}
