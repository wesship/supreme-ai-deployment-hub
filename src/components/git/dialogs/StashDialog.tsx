
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StashDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stashMessage: string;
  setStashMessage: (message: string) => void;
  onCreateStash: () => void;
}

export const StashDialog = ({
  isOpen,
  onOpenChange,
  stashMessage,
  setStashMessage,
  onCreateStash
}: StashDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Stash</DialogTitle>
          <DialogDescription>
            Stash your current changes to save them for later without committing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="stashMessage">Stash Message (optional)</Label>
            <Input
              id="stashMessage"
              placeholder="WIP: Feature in progress..."
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreateStash}>Create Stash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StashDialog;
