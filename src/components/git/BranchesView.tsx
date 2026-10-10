
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitBranch, GitMerge, Plus, GitCompareArrows } from 'lucide-react';
import { GitRepository, GitBranch as Branch } from '@/services/git';

interface BranchesViewProps {
  repository: GitRepository;
  branches: Branch[];
  loading: boolean;
  onCreateBranch: () => void;
  onSwitchBranch: (branch: string) => void;
  onMergeBranch: (branch: string) => void;
  onCompareBranches?: () => void;
}

const BranchesView: React.FC<BranchesViewProps> = ({
  repository,
  branches,
  loading,
  onCreateBranch,
  onSwitchBranch,
  onMergeBranch,
  onCompareBranches
}) => {
  // Separate local and remote branches
  const localBranches = branches.filter(branch => !branch.isRemote);
  const remoteBranches = branches.filter(branch => branch.isRemote);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Branches
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCreateBranch}>
              <Plus className="h-4 w-4 mr-1" />
              New Branch
            </Button>
            {onCompareBranches && (
              <Button variant="outline" size="sm" onClick={onCompareBranches}>
                <GitCompareArrows className="h-4 w-4 mr-1" />
                Compare
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Local Branches</h3>
              {localBranches.length === 0 ? (
                <div className="text-sm text-muted-foreground">No local branches found</div>
              ) : (
                <div className="space-y-2">
                  {localBranches.map(branch => (
                    <div 
                      key={branch.name} 
                      className={`p-2 rounded-md flex items-center justify-between ${branch.isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}
                    >
                      <div className="flex items-center">
                        <GitBranch className={`h-4 w-4 mr-2 ${branch.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={branch.isActive ? 'font-medium' : ''}>{branch.name}</span>
                        {branch.upstream && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {branch.ahead && branch.ahead > 0 ? `↑${branch.ahead}` : ''}
                            {branch.behind && branch.behind > 0 ? `↓${branch.behind}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!branch.isActive && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => onSwitchBranch(branch.name)}>
                              Switch
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => onMergeBranch(branch.name)}
                              title={`Merge ${branch.name} into ${repository.branch}`}
                            >
                              <GitMerge className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Remote Branches</h3>
              {remoteBranches.length === 0 ? (
                <div className="text-sm text-muted-foreground">No remote branches found</div>
              ) : (
                <div className="space-y-2">
                  {remoteBranches.map(branch => (
                    <div key={branch.name} className="p-2 rounded-md flex items-center justify-between hover:bg-muted">
                      <div className="flex items-center">
                        <GitBranch className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{branch.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BranchesView;
