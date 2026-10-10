
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeployment } from '@/contexts/DeploymentContext';

import DeploymentGuide from './DeploymentGuide';
import DeploymentControlTabs from './DeploymentControlTabs';
import DeploymentActionButtons from './DeploymentActionButtons';
import KubeConfigConnect from './KubeConfigConnect';

const DeploymentControls = () => {
  const [showGuide, setShowGuide] = useState(false);
  const { isConnected } = useDeployment();

  return (
    <Card className="shadow-md border-border">
      <CardHeader>
        <div className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Deployment Controls</CardTitle>
            <CardDescription>Connect to your Kubernetes cluster and manage deployments</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowGuide(!showGuide)}
                  className="h-8 w-8 p-0"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle deployment guide</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {showGuide && (
          <DeploymentGuide onHideGuide={() => setShowGuide(false)} />
        )}

        {!isConnected ? (
          <DeploymentControlTabs />
        ) : (
          <>
            <KubeConfigConnect />
            <DeploymentActionButtons />
          </>
        )}
      </CardContent>
      {showGuide && (
        <CardFooter className="border-t border-border bg-muted/30 p-3 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Need help? Refer to <a href="/documentation" className="text-blue-600 underline dark:text-blue-400 hover:text-blue-800">full deployment documentation</a>
          </p>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowGuide(false)}>
            Hide Guide
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default DeploymentControls;
