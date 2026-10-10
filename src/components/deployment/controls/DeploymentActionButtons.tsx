
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, RefreshCw, XCircle } from 'lucide-react';
import { useDeployment } from '@/contexts/DeploymentContext';
import { Separator } from '@/components/ui/separator';

const DeploymentActionButtons = () => {
  const { isDeploying, startDeployment, cancelDeployment } = useDeployment();

  return (
    <div className="space-y-4">
      <Separator />
      <div className="flex gap-2">
        {!isDeploying ? (
          <Button onClick={() => startDeployment()} className="w-full bg-blue-600 hover:bg-blue-700">
            <Play className="mr-2 h-4 w-4" />
            Start Deployment
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={cancelDeployment} className="w-1/2 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button variant="secondary" disabled className="w-1/2">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default DeploymentActionButtons;
