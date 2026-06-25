
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeployment } from '@/contexts/DeploymentContext';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const DeploymentSummary = () => {
  const { deploymentSteps, isDeploying, currentStep } = useDeployment();

  // Derive deployment status from steps
  const hasFailed = deploymentSteps.some(step => step.status === 'error');
  const allCompleted = deploymentSteps.every(step => step.status === 'success');
  const deploymentStatus = hasFailed ? 'failed' : 
                           allCompleted ? 'success' : 
                           isDeploying ? 'in-progress' : 'idle';

  // Mock data for deployment details
  const deploymentName = "D3VONN.IO Framework v1.0";
  const deploymentEnv = "Production";
  
  // Find the first step that started and the last one that completed (if any)
  const firstStartedStep = deploymentSteps.find(step => 
    step.status === 'success' || step.status === 'in-progress' || step.status === 'error'
  );
  const lastCompletedStep = [...deploymentSteps].reverse().find(step => step.status === 'success');
  
  // Create mock timestamps based on whether steps have started/completed
  const startTime = firstStartedStep ? new Date(Date.now() - 3600000).toISOString() : null; // 1 hour ago
  const endTime = allCompleted ? new Date().toISOString() : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <CardTitle>Deployment Summary</CardTitle>
            <CardDescription>Overview of the current deployment process</CardDescription>
          </div>
          <Badge 
            className={
              deploymentStatus === 'success' ? 'bg-green-500' : 
              deploymentStatus === 'in-progress' ? 'bg-blue-500' : 
              deploymentStatus === 'failed' ? 'bg-red-500' : 
              'bg-gray-500'
            }
          >
            {deploymentStatus === 'success' ? 'Completed' : 
             deploymentStatus === 'in-progress' ? 'In Progress' : 
             deploymentStatus === 'failed' ? 'Failed' : 
             'Not Started'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Deployment Details</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Name:</span>
                <span className="text-sm font-medium">{deploymentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Environment:</span>
                <span className="text-sm font-medium">{deploymentEnv}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-2">Timing</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Started:</span>
                <span className="text-sm font-medium">
                  {startTime ? new Date(startTime).toLocaleString() : 'Not started'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Completed:</span>
                <span className="text-sm font-medium">
                  {endTime ? new Date(endTime).toLocaleString() : 'In progress'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-medium">Deployment Status</h4>
            <p className="text-sm text-muted-foreground">
              {deploymentStatus === 'success' ? 'Deployment completed successfully' : 
               deploymentStatus === 'in-progress' ? 'Deployment is currently in progress' : 
               deploymentStatus === 'failed' ? 'Deployment failed with errors' : 
               'Deployment not yet started'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeploymentSummary;
