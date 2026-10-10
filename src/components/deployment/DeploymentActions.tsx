
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';
import { useDeployment } from '@/contexts/DeploymentContext';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DeploymentActions = () => {
  const { 
    startDeployment, 
    cancelDeployment, 
    isDeploying,
    logs,
    deploymentSteps
  } = useDeployment();

  // Determine if any steps have failed
  const hasFailed = deploymentSteps.some(step => step.status === 'error');
  
  // Derive deployment status from steps
  const allCompleted = deploymentSteps.every(step => step.status === 'success');
  const deploymentStatus = hasFailed ? 'failed' : 
                           allCompleted ? 'success' : 
                           isDeploying ? 'in-progress' : 'idle';

  // Function to reset deployment by calling cancel
  const resetDeployment = () => {
    cancelDeployment();
  };

  // Function to stop deployment by calling cancel
  const stopDeployment = () => {
    cancelDeployment();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={startDeployment}
            disabled={isDeploying || deploymentStatus === 'success'}
            className="flex items-center"
          >
            <Play className="mr-2 h-4 w-4" />
            {deploymentStatus === 'failed' ? 'Retry Deployment' : 'Start Deployment'}
          </Button>
          
          <Button
            variant="outline"
            onClick={stopDeployment}
            disabled={!isDeploying}
            className="flex items-center"
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause Deployment
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center"
                disabled={deploymentStatus === 'idle'}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Deployment</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the entire deployment process. All progress will be lost. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetDeployment}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {hasFailed && (
            <div className="w-full mt-4 p-3 bg-red-100 text-red-800 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Deployment Failed</p>
                <p className="text-sm">There was an error during the deployment process. Please check the logs for more details.</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeploymentActions;
