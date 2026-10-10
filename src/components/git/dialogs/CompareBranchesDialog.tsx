import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GitBranch, GitCompareArrows } from 'lucide-react';
import { GitRepository, GitBranch as Branch } from '@/services/git';
import { Label } from '@/components/ui/label';

interface CompareBranchesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  repository: GitRepository;
  branches: Branch[];
  currentBranch: string;
  loading: boolean;
  onCompareBranches: (sourceBranch: string, targetBranch: string) => void;
}

const CompareBranchesDialog: React.FC<CompareBranchesDialogProps> = ({
  isOpen,
  onOpenChange,
  repository,
  branches,
  currentBranch,
  loading,
  onCompareBranches
}) => {
  const [sourceBranch, setSourceBranch] = useState(currentBranch);
  const [targetBranch, setTargetBranch] = useState('');
  
  useEffect(() => {
    setSourceBranch(currentBranch);
  }, [currentBranch]);
  
  useEffect(() => {
    if (branches.length > 0 && !targetBranch) {
      const otherBranch = branches.find(branch => 
        !branch.isRemote && branch.name !== sourceBranch
      );
      
      if (otherBranch) {
        setTargetBranch(otherBranch.name);
      } else if (branches.length > 1) {
        setTargetBranch(branches[0].name === sourceBranch ? branches[1].name : branches[0].name);
      }
    }
  }, [branches, sourceBranch, targetBranch]);
  
  const localBranches = branches.filter(branch => !branch.isRemote);
  
  const handleCompare = () => {
    if (sourceBranch && targetBranch) {
      onCompareBranches(sourceBranch, targetBranch);
    }
  };

  const canCompare = sourceBranch && targetBranch && sourceBranch !== targetBranch;
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5" />
            Compare Branches
          </DialogTitle>
          <DialogDescription>
            Select two branches to compare their differences
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source-branch">Source Branch</Label>
            <Select 
              value={sourceBranch} 
              onValueChange={setSourceBranch}
              disabled={loading || localBranches.length <= 1}
            >
              <SelectTrigger id="source-branch" className="w-full">
                <SelectValue placeholder="Select source branch" />
              </SelectTrigger>
              <SelectContent>
                {localBranches.map(branch => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center">
                      <GitBranch className="h-4 w-4 mr-2 text-blue-500" />
                      {branch.name} {branch.isActive && '(current)'}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-center">
            <div className="bg-muted rounded-full p-2">
              <GitCompareArrows className="h-5 w-5" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="target-branch">Target Branch</Label>
            <Select 
              value={targetBranch} 
              onValueChange={setTargetBranch}
              disabled={loading || localBranches.length <= 1}
            >
              <SelectTrigger id="target-branch" className="w-full">
                <SelectValue placeholder="Select target branch" />
              </SelectTrigger>
              <SelectContent>
                {localBranches.map(branch => (
                  <SelectItem 
                    key={branch.name} 
                    value={branch.name}
                    disabled={branch.name === sourceBranch}
                  >
                    <div className="flex items-center">
                      <GitBranch className="h-4 w-4 mr-2 text-green-500" />
                      {branch.name} {branch.isActive && '(current)'}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {localBranches.length <= 1 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-amber-800 dark:text-amber-300 text-sm">
              You need at least two branches to compare. Create another branch first.
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleCompare}
            disabled={!canCompare || loading}
          >
            Compare Branches
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompareBranchesDialog;
