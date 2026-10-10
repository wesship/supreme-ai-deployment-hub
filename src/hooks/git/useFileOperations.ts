
import { useState } from 'react';
import { GitRepository, gitService } from '@/services/git';
import { toast } from 'sonner';

export function useFileOperations(repository: GitRepository) {
  const [isDiscardChangesDialogOpen, setIsDiscardChangesDialogOpen] = useState(false);
  const [filesToDiscard, setFilesToDiscard] = useState<string[]>([]);

  // Handle discarding changes
  const handleDiscardChanges = async () => {
    try {
      await gitService.discardChanges(repository, filesToDiscard.length > 0 ? filesToDiscard : undefined);
      setFilesToDiscard([]);
      setIsDiscardChangesDialogOpen(false);
    } catch (error) {
      console.error('Error discarding changes:', error);
      toast.error(`Failed to discard changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return {
    isDiscardChangesDialogOpen,
    filesToDiscard,
    setIsDiscardChangesDialogOpen,
    setFilesToDiscard,
    handleDiscardChanges
  };
}
