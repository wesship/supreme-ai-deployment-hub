
import { useState } from 'react';
import { GitRepository, GitCommit, GitDiff, gitService } from '@/services/git';
import { toast } from 'sonner';

export function useCommitHistory(repository: GitRepository) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [diffs, setDiffs] = useState<GitDiff[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  
  // Pagination for commits
  const [commitSkip, setCommitSkip] = useState(0);
  const COMMIT_LIMIT = 10;
  
  // Load commit history
  const loadCommits = async (skip = 0) => {
    setLoadingCommits(true);
    try {
      const result = await gitService.getCommitHistory(repository, COMMIT_LIMIT, skip);
      if (skip === 0) {
        setCommits(result);
      } else {
        setCommits(prev => [...prev, ...result]);
      }
      setCommitSkip(skip);
    } catch (error) {
      console.error('Error loading commits:', error);
      toast.error('Failed to load commit history');
    } finally {
      setLoadingCommits(false);
    }
  };
  
  // Load more commits
  const handleLoadMoreCommits = () => {
    loadCommits(commitSkip + COMMIT_LIMIT);
  };
  
  // Handle commit selection
  const handleCommitSelect = async (commit: GitCommit) => {
    setSelectedCommit(commit);
    setLoadingDiff(true);
    try {
      // Get diff between this commit and previous
      const previousCommitIndex = commits.findIndex(c => c.id === commit.id) + 1;
      const previousCommit = previousCommitIndex < commits.length ? commits[previousCommitIndex] : null;
      const diffResult = await gitService.getDiff(
        repository, 
        previousCommit?.hash || `${commit.hash}^`, 
        commit.hash
      );
      setDiffs(diffResult);
    } catch (error) {
      console.error('Error loading diff:', error);
      toast.error('Failed to load commit differences');
    } finally {
      setLoadingDiff(false);
    }
  };

  return {
    commits,
    diffs,
    selectedCommit,
    loadingCommits,
    loadingDiff,
    loadCommits,
    handleLoadMoreCommits,
    handleCommitSelect
  };
}
