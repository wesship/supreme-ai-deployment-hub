
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateBranchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newBranchName: string;
  setNewBranchName: (name: string) => void;
  onCreateBranch: () => void;
}

export const CreateBranchDialog = ({
  isOpen,
  onOpenChange,
  newBranchName,
  setNewBranchName,
  onCreateBranch
}: CreateBranchDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>
            Enter a name for the new branch. It will be created from the current HEAD.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              id="branch-name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/my-new-feature"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreateBranch}>Create Branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBranchDialog;
