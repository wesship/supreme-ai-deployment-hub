
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GitCommit } from '@/services/git';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateTagDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tagName: string;
  tagMessage: string;
  selectedCommit: string;
  setTagName: (name: string) => void;
  setTagMessage: (message: string) => void;
  setSelectedCommit: (commit: string) => void;
  commits: GitCommit[];
  onCreateTag: () => void;
}

export const CreateTagDialog = ({
  isOpen,
  onOpenChange,
  tagName,
  tagMessage,
  selectedCommit,
  setTagName,
  setTagMessage,
  setSelectedCommit,
  commits,
  onCreateTag
}: CreateTagDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tag</DialogTitle>
          <DialogDescription>
            Create a new tag to mark an important point in your repository history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tagName">Tag Name *</Label>
            <Input
              id="tagName"
              placeholder="v1.0.0"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="commitSelect">Commit</Label>
            <Select value={selectedCommit} onValueChange={setSelectedCommit}>
              <SelectTrigger>
                <SelectValue placeholder="HEAD (current commit)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEAD">HEAD (current commit)</SelectItem>
                {commits.map((commit) => (
                  <SelectItem key={commit.hash} value={commit.hash}>
                    {commit.shortHash} - {commit.message}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tagMessage">Tag Message (optional)</Label>
            <Textarea
              id="tagMessage"
              placeholder="Describe the significance of this tag..."
              value={tagMessage}
              onChange={(e) => setTagMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreateTag} disabled={!tagName}>Create Tag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTagDialog;
