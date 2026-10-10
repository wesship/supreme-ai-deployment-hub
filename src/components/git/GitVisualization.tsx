
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GitRepository, GitBranch } from '@/services/git';
import BranchesView from './BranchesView';
import ComparisonView from './ComparisonView';
import { CreateBranchDialog } from './dialogs/CreateBranchDialog';
import { MergeBranchDialog } from './dialogs/MergeBranchDialog';
import CompareBranchesDialog from './dialogs/CompareBranchesDialog';
import { useBranchOperations, useCompareOperations } from '@/hooks/git';

interface GitVisualizationProps {
  repository: GitRepository;
  onUpdateRepository: (repo: GitRepository) => void;
}

const GitVisualization: React.FC<GitVisualizationProps> = ({ repository, onUpdateRepository }) => {
  // Use the branch operations hook
  const {
    branches,
    loadingBranches,
    isCreateBranchDialogOpen,
    isMergeBranchDialogOpen,
    branchToMerge,
    setIsCreateBranchDialogOpen,
    setIsMergeBranchDialogOpen,
    loadBranches,
    handleCreateBranch,
    handleSwitchBranch,
    handleMergeBranch,
    confirmMergeBranch,
    newBranchName, 
    setNewBranchName
  } = useBranchOperations(repository, onUpdateRepository);

  // Use the compare operations hook
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
  
  // Load branches on mount and when repository changes
  useEffect(() => {
    if (repository?.id) {
      loadBranches();
    }
  }, [repository?.id]);

  return (
    <div className="space-y-6">
      {/* Display branches view */}
      <BranchesView
        repository={repository}
        branches={branches}
        loading={loadingBranches}
        onCreateBranch={() => setIsCreateBranchDialogOpen(true)}
        onSwitchBranch={(branchName) => handleSwitchBranch(branchName)}
        onMergeBranch={(branchName) => handleMergeBranch(branchName)}
        onCompareBranches={() => setIsCompareDialogOpen(true)}
      />

      {/* Show comparison view when active */}
      {showComparison && (
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium">Branch Comparison</h3>
              <button 
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={closeComparison}
              >
                Close
              </button>
            </div>
            <ComparisonView
              sourceBranch={sourceBranchName}
              targetBranch={targetBranchName}
              diffs={comparisonDiffs}
              loading={isComparing}
            />
          </CardContent>
        </Card>
      )}

      {/* Create Branch Dialog */}
      <CreateBranchDialog 
        isOpen={isCreateBranchDialogOpen}
        onOpenChange={setIsCreateBranchDialogOpen}
        newBranchName={newBranchName}
        setNewBranchName={setNewBranchName}
        onCreateBranch={handleCreateBranch}
      />

      {/* Merge Branch Dialog */}
      <MergeBranchDialog
        isOpen={isMergeBranchDialogOpen}
        onOpenChange={setIsMergeBranchDialogOpen}
        branchToMerge={branchToMerge}
        repository={repository}
        onConfirmMerge={confirmMergeBranch}
      />

      {/* Compare Branches Dialog */}
      <CompareBranchesDialog
        isOpen={isCompareDialogOpen}
        onOpenChange={setIsCompareDialogOpen}
        branches={branches}
        currentBranch={repository.branch}
        repository={repository}
        loading={loadingBranches}
        onCompareBranches={handleCompareBranches}
      />
    </div>
  );
};

export default GitVisualization;
