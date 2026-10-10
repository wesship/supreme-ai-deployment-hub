
import { useState } from 'react';
import { GitRepository, GitDiff, GitBranch, gitService } from '@/services/git';
import { toast } from 'sonner';

export function useCompareOperations(repository: GitRepository) {
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDiffs, setComparisonDiffs] = useState<GitDiff[]>([]);
  const [sourceBranchName, setSourceBranchName] = useState('');
  const [targetBranchName, setTargetBranchName] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  
  // Handle branch comparison
  const handleCompareBranches = async (sourceBranch: string, targetBranch: string) => {
    setIsComparing(true);
    setSourceBranchName(sourceBranch);
    setTargetBranchName(targetBranch);
    
    try {
      // Check for potential merge conflicts
      const conflictCheck = await gitService.detectMergeConflicts(repository, sourceBranch, targetBranch);
      
      if (conflictCheck.hasConflicts) {
        toast.warning(`Potential merge conflicts detected in ${conflictCheck.conflictingFiles?.length} files`);
      }
      
      // Get actual differences
      const diffs = await gitService.compareBranches(repository, sourceBranch, targetBranch);
      setComparisonDiffs(diffs);
      setShowComparison(true);
      setIsCompareDialogOpen(false);
    } catch (error) {
      console.error('Error comparing branches:', error);
      toast.error(`Failed to compare branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsComparing(false);
    }
  };
  
  const closeComparison = () => {
    setShowComparison(false);
  };

  return {
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
