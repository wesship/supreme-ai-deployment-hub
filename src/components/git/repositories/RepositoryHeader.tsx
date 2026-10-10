
import React from 'react';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { RefreshCw, GitBranch, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import AddRepositoryDialogContainer from './AddRepositoryDialogContainer';

interface RepositoryHeaderProps {
  loading: boolean;
  isRefreshing: boolean;
  repositoriesCount: number;
  onRefreshAll: () => void;
  onCloneRepository: (url: string, branch: string, token: string) => Promise<boolean>;
  onOpenAddDialog?: () => void;
}

const RepositoryHeader: React.FC<RepositoryHeaderProps> = ({
  loading,
  isRefreshing,
  repositoriesCount,
  onRefreshAll,
  onCloneRepository,
  onOpenAddDialog
}) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <CardTitle>Git Repositories</CardTitle>
        <CardDescription>Manage your Git repositories and sync changes</CardDescription>
      </div>
      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onRefreshAll} 
                disabled={loading || isRefreshing || repositoriesCount === 0}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh All Repositories</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRefreshAll} disabled={repositoriesCount === 0}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <GitBranch className="h-4 w-4 mr-2" />
              Manage Remote Sources
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Info className="h-4 w-4 mr-2" />
              Show Git Configuration
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <AddRepositoryDialogContainer
          loading={loading}
          onCloneRepository={onCloneRepository}
          onOpenAddDialog={onOpenAddDialog}
        />
      </div>
    </div>
  );
};

export default RepositoryHeader;
