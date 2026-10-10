
import { useState } from 'react';
import { GitRepository, GitStashEntry, gitService } from '@/services/git';
import { toast } from 'sonner';

export function useStashOperations(repository: GitRepository) {
  const [stashes, setStashes] = useState<GitStashEntry[]>([]);
  const [loadingStashes, setLoadingStashes] = useState(false);
  const [isStashDialogOpen, setIsStashDialogOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');

  // Load stashes
  const loadStashes = async () => {
    setLoadingStashes(true);
    try {
      const result = await gitService.getStashes(repository);
      setStashes(result);
    } catch (error) {
      console.error('Error loading stashes:', error);
      toast.error('Failed to load stashes');
    } finally {
      setLoadingStashes(false);
    }
  };

  // Handle stash creation
  const handleCreateStash = async () => {
    try {
      await gitService.createStash(repository, stashMessage);
      await loadStashes();
      setStashMessage('');
      setIsStashDialogOpen(false);
    } catch (error) {
      console.error('Error creating stash:', error);
      toast.error(`Failed to create stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle stash application
  const handleApplyStash = async (stashId: string, drop = true) => {
    try {
      await gitService.applyStash(repository, stashId, drop);
      await loadStashes();
    } catch (error) {
      console.error('Error applying stash:', error);
      toast.error(`Failed to apply stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle stash dropping
  const handleDropStash = async (stashId: string) => {
    try {
      await gitService.dropStash(repository, stashId);
      await loadStashes();
    } catch (error) {
      console.error('Error dropping stash:', error);
      toast.error(`Failed to drop stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return {
    stashes,
    loadingStashes,
    isStashDialogOpen,
    stashMessage,
    setIsStashDialogOpen,
    setStashMessage,
    loadStashes,
    handleCreateStash,
    handleApplyStash,
    handleDropStash
  };
}
