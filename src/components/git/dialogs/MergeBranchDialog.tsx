
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GitRepository } from '@/services/git';

interface MergeBranchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  branchToMerge: string;
  repository: GitRepository;
  onConfirmMerge: () => void;
}

export const MergeBranchDialog = ({
  isOpen,
  onOpenChange,
  branchToMerge,
  repository,
  onConfirmMerge
}: MergeBranchDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Branch</DialogTitle>
          <DialogDescription>
            Are you sure you want to merge {branchToMerge} into {repository.branch}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirmMerge}>Merge Branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeBranchDialog;
