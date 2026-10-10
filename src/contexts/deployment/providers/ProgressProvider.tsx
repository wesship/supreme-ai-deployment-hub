
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DeploymentStep, DeploymentEnvironment } from '../../../types/deployment';
import { createLogger } from '../../../services/deployment/loggingService';

interface ProgressContextType {
  overallProgress: number;
  updateProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

interface ProgressProviderProps {
  children: React.ReactNode;
  deploymentSteps: DeploymentStep[];
  environment: DeploymentEnvironment;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ 
  children, 
  deploymentSteps,
  environment
}) => {
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const lastProgressUpdateRef = useRef<number>(0);
  const logger = createLogger(environment, 'aws');

  const updateProgress = () => {
    const completedSteps = deploymentSteps.filter(step => step.status === 'success').length;
    const totalSteps = deploymentSteps.length;
    const inProgressSteps = deploymentSteps.filter(step => step.status === 'in-progress');
    
    let progress = 0;
    if (inProgressSteps.length > 0) {
      const currentProgress = inProgressSteps[0].progress / 100;
      progress = (completedSteps + currentProgress) / totalSteps * 100;
    } else {
      progress = (completedSteps / totalSteps) * 100;
    }
    
    const roundedProgress = Math.round(progress * 100) / 100;
    
    if (Math.abs(roundedProgress - lastProgressUpdateRef.current) >= 0.5) {
      setOverallProgress(roundedProgress);
      lastProgressUpdateRef.current = roundedProgress;
      
      logger.info(`Deployment Progress: ${Math.floor(roundedProgress)}%`, {
        environment: environment,
        completedSteps,
        totalSteps,
        stepDetails: deploymentSteps.map(step => ({
          id: step.id,
          title: step.title,
          status: step.status,
          progress: step.progress
        })),
        currentStep: inProgressSteps.length > 0 ? {
          id: inProgressSteps[0].id,
          title: inProgressSteps[0].title
        } : null
      });
    }
  };
  
  useEffect(() => {
    updateProgress();
  }, [deploymentSteps]);

  const value = useMemo(() => ({
    overallProgress,
    updateProgress,
  }), [overallProgress]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};
