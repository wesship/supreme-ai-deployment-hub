
import React from 'react';
import { GitBranch, Plus, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface EmptyRepositoryStateProps {
  onAddRepository?: () => void;
}

const EmptyRepositoryState: React.FC<EmptyRepositoryStateProps> = ({ onAddRepository }) => {
  return (
    <Card className="border-dashed border-2 p-8 text-center">
      <div className="flex flex-col items-center justify-center space-y-6 py-8">
        <div className="rounded-full bg-muted p-6">
          <GitBranch className="h-10 w-10 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-medium">No repositories added yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add your first Git repository to start managing your code. You can clone existing repositories or create new ones.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          <Button onClick={onAddRepository} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Repository
          </Button>
          
          <Button variant="outline" className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            Connect GitHub Account
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EmptyRepositoryState;
