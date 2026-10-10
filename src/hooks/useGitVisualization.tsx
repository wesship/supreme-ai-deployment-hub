
import { useEffect, useState } from 'react';
import { GitRepository, GitCommit, GitDiff, GitBranch, GitStashEntry, GitTag, gitService } from '@/services/git';
import { toast } from 'sonner';
import { useCommitHistory } from './git/useCommitHistory';
import { useBranchOperations } from './git/useBranchOperations';
import { useStashOperations } from './git/useStashOperations';
import { useFileOperations } from './git/useFileOperations';
import { useTagOperations } from './git/useTagOperations';
import { useCompareOperations } from './git/useCompareOperations';

export function useGitVisualization(repository: GitRepository, onUpdateRepository: (repo: GitRepository) => void) {
  // Get operations from specialized hooks
  const {
    commits,
    diffs,
    selectedCommit,
    loadingCommits,
    loadingDiff,
    loadCommits,
    handleLoadMoreCommits,
    handleCommitSelect
  } = useCommitHistory(repository);
  
  const {
    branches,
    loadingBranches,
    isCreateBranchDialogOpen,
    isMergeBranchDialogOpen,
    newBranchName,
    branchToMerge,
    setIsCreateBranchDialogOpen,
    setIsMergeBranchDialogOpen,
    setNewBranchName,
    loadBranches,
    handleCreateBranch,
    handleSwitchBranch,
    handleMergeBranch,
    confirmMergeBranch
  } = useBranchOperations(repository, onUpdateRepository);
  
  const {
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
  } = useStashOperations(repository);
  
  const {
    isDiscardChangesDialogOpen,
    filesToDiscard,
    setIsDiscardChangesDialogOpen,
    setFilesToDiscard,
    handleDiscardChanges
  } = useFileOperations(repository);
  
  const {
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
  } = useTagOperations(repository);
  
  const {
    isCompareDialogOpen,
    setIsCompareDialogOpen,
    isComparing,
    comparisonDiffs,
    sourceBranchName,
    targetBranchName,
    showComparison,
    handleCompareBranches,
    closeComparison
  } = useCompareOperations(repository);
  
  // Load data when the component mounts or repository changes
  useEffect(() => {
    loadCommits();
    loadBranches();
    loadStashes();
    loadTags();
  }, [repository.id]);
  
  return {
    // Commit history
    commits,
    diffs,
    selectedCommit,
    loadingCommits,
    loadingDiff,
    handleLoadMoreCommits,
    handleCommitSelect,
    
    // Branch operations
    branches,
    loadingBranches,
    isCreateBranchDialogOpen,
    isMergeBranchDialogOpen,
    newBranchName,
    branchToMerge,
    setIsCreateBranchDialogOpen,
    setIsMergeBranchDialogOpen,
    setNewBranchName,
    handleCreateBranch,
    handleSwitchBranch,
    handleMergeBranch,
    confirmMergeBranch,
    
    // Stash operations
    stashes,
    loadingStashes,
    isStashDialogOpen,
    stashMessage,
    setIsStashDialogOpen,
    setStashMessage,
    handleCreateStash,
    handleApplyStash,
    handleDropStash,
    
    // File operations
    isDiscardChangesDialogOpen,
    filesToDiscard,
    setIsDiscardChangesDialogOpen,
    setFilesToDiscard,
    handleDiscardChanges,
    
    // Tag operations
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
    handleCreateTag,
    handleDeleteTag,
    
    // Branch comparison
    isCompareDialogOpen,
    setIsCompareDialogOpen,
    isComparing,
    comparisonDiffs,
    sourceBranchName,
    targetBranchName,
    showComparison,
    handleCompareBranches,
    closeComparison
  };
}
