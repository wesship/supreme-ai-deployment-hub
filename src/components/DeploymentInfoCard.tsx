
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeployment } from '@/contexts/DeploymentContext';

interface DeploymentInfoCardProps {
  title: string;
  description?: string;
  status: 'success' | 'warning' | 'error' | 'pending' | 'in-progress';
  progress?: number;
  className?: string;
  children?: React.ReactNode;
  stepId?: string;
  onClick?: () => void;
}

const DeploymentInfoCard: React.FC<DeploymentInfoCardProps> = ({
  title,
  description,
  status,
  progress,
  className,
  children,
  stepId,
  onClick,
}) => {
  const { isDeploying, currentStep, runStep } = useDeployment();
  
  const statusColors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-gray-400',
    'in-progress': 'bg-blue-500',
  };

  const statusText = {
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    pending: 'Pending',
    'in-progress': 'In Progress',
  };

  const handleRunStep = async () => {
    if (stepId && !isDeploying) {
      onClick?.();
      await runStep(stepId);
    }
  };

  const isActive = stepId && currentStep === stepId;

  return (
    <Card className={cn(
      "transition-all duration-300", 
      isActive ? "border-primary" : "",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge className={statusColors[status]}>{statusText[status]}</Badge>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {typeof progress === 'number' && (
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        {children}
        
        {stepId && status === 'pending' && !isDeploying && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={handleRunStep}
          >
            <Play className="h-3 w-3 mr-1" /> Run this step
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DeploymentInfoCard;
