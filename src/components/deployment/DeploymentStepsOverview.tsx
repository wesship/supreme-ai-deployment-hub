
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeployment } from '@/contexts/DeploymentContext';
import { Badge } from '@/components/ui/badge';
import DeploymentInfoCard from '@/components/DeploymentInfoCard';
import { DeploymentStatus } from '@/types/deployment';

const DeploymentStepsOverview = () => {
  const { 
    deploymentSteps, 
    runStep, 
    isDeploying, 
    currentStep 
  } = useDeployment();

  // Group steps by status for easier rendering
  const completedSteps = deploymentSteps.filter(step => step.status === 'success');
  
  // Include in-progress steps and also steps that are currently rolling back
  const inProgressSteps = deploymentSteps.filter(
    step => step.status === 'in-progress' || step.status === 'rolling-back'
  );
  
  // Any step that is not completed or in progress is considered pending
  const pendingSteps = deploymentSteps.filter(
    step => {
      const status = step.status;
      return status !== 'success' && 
             status !== 'in-progress' && 
             status !== 'rolling-back';
    }
  );

  // Helper function to map deployment statuses to compatible card statuses
  const mapStatusForCard = (status: DeploymentStatus): 'success' | 'warning' | 'error' | 'pending' | 'in-progress' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'in-progress':
        return 'in-progress';
      case 'rolling-back':
        return 'in-progress';
      case 'rolled-back':
      case 'rollback-skipped':
        return 'warning';
      case 'rollback-failed':
        return 'error';
      case 'pending':
      default:
        return 'pending';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md">Deployment Steps</CardTitle>
        <div className="flex space-x-2">
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Completed: {completedSteps.length}
          </Badge>
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            In Progress: {inProgressSteps.length}
          </Badge>
          <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            Pending: {pendingSteps.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deploymentSteps.map((step) => (
            <DeploymentInfoCard
              key={step.id}
              title={step.title}
              description={step.description}
              status={mapStatusForCard(step.status)}
              progress={step.progress}
              stepId={step.id}
              onClick={() => runStep(step.id)}
              className={currentStep === step.id ? "border-primary" : ""}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeploymentStepsOverview;
