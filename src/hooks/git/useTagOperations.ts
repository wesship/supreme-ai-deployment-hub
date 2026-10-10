
import { useState } from 'react';
import { GitRepository, GitTag, gitService } from '@/services/git';
import { toast } from 'sonner';

export function useTagOperations(repository: GitRepository) {
  const [tags, setTags] = useState<GitTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');
  const [newTagCommit, setNewTagCommit] = useState('HEAD');

  // Load tags
  const loadTags = async () => {
    setLoadingTags(true);
    try {
      const result = await gitService.getTags(repository);
      setTags(result);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoadingTags(false);
    }
  };

  // Handle tag creation
  const handleCreateTag = async () => {
    if (!newTagName) {
      toast.error('Tag name is required');
      return;
    }
    
    try {
      await gitService.createTag(repository, newTagName, newTagCommit, newTagMessage);
      await loadTags();
      setNewTagName('');
      setNewTagMessage('');
      setNewTagCommit('HEAD');
      setIsCreateTagDialogOpen(false);
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle tag deletion
  const handleDeleteTag = async (tagName: string) => {
    try {
      await gitService.deleteTag(repository, tagName);
      await loadTags();
      toast.success(`Tag "${tagName}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return {
    tags,
    loadingTags,
    isCreateTagDialogOpen,
    newTagName,
    newTagMessage,
    newTagCommit,
    setIsCreateTagDialogOpen,
    setNewTagName,
    setNewTagMessage,
    setNewTagCommit,
    loadTags,
    handleCreateTag,
    handleDeleteTag
  };
}
