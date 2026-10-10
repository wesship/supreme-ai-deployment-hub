
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AddRepositoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  newRepoUrl: string;
  setNewRepoUrl: (url: string) => void;
  newRepoBranch: string;
  setNewRepoBranch: (branch: string) => void;
  newRepoToken: string;
  setNewRepoToken: (token: string) => void;
  onCloneRepository: () => void;
}

const AddRepositoryDialog = ({
  isOpen,
  onOpenChange,
  loading,
  newRepoUrl,
  setNewRepoUrl,
  newRepoBranch,
  setNewRepoBranch,
  newRepoToken,
  setNewRepoToken,
  onCloneRepository,
}: AddRepositoryDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Repository</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Git Repository</DialogTitle>
          <DialogDescription>
            Clone a Git repository to work with
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/username/repository.git"
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-branch">Branch</Label>
            <Input
              id="repo-branch"
              placeholder="main"
              value={newRepoBranch}
              onChange={(e) => setNewRepoBranch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token (for private repositories)</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="ghp_youraccesstoken"
              value={newRepoToken}
              onChange={(e) => setNewRepoToken(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCloneRepository} disabled={loading}>
            {loading ? 'Cloning...' : 'Clone Repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRepositoryDialog;
