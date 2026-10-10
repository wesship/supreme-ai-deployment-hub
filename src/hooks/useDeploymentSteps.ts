
import { useState } from 'react';
import { DeploymentStep } from '../types/deployment';

export const useDeploymentSteps = () => {
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([
    {
      id: 'prerequisites',
      title: 'Prerequisites',
      description: 'Set up cloud provider and install required tools',
      status: 'pending',
      icon: '/lovable-uploads/a65e1231-578b-497e-8b86-06503b0b6eae.png',
      progress: 0,
    },
    {
      id: 'infrastructure',
      title: 'Infrastructure Setup',
      description: 'Configure Kubernetes cluster and persistent storage',
      status: 'pending',
      icon: '/lovable-uploads/3ae77958-660d-4e58-9ea4-8fec69755b33.png',
      progress: 0,
    },
    {
      id: 'backend',
      title: 'Backend Services',
      description: 'Deploy backend services and APIs',
      status: 'pending',
      icon: '/lovable-uploads/e06effdb-49e8-415b-ba43-d67319d4d975.png',
      progress: 0,
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      description: 'Set up Prometheus and Grafana',
      status: 'pending',
      icon: '/lovable-uploads/89803b30-4c31-445d-b3a9-4ce66f2d4135.png',
      progress: 0,
    },
    {
      id: 'testing',
      title: 'Testing',
      description: 'Run end-to-end and load tests',
      status: 'pending',
      icon: '/lovable-uploads/b6150d98-c2bc-47a2-8da1-2391d04d8dce.png',
      progress: 0,
    },
    {
      id: 'finalize',
      title: 'Finalize',
      description: 'Update DNS and announce launch',
      status: 'pending',
      icon: '/lovable-uploads/5fe3964f-7cb4-4a09-a27b-fc5233b042dc.png',
      progress: 0,
    },
  ]);
  
  const [currentStep, setCurrentStep] = useState<string>('');

  // Update a specific step
  const updateStep = (stepId: string, update: Partial<DeploymentStep>) => {
    setDeploymentSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, ...update } : step
      )
    );
  };

  return {
    deploymentSteps,
    setDeploymentSteps,
    currentStep,
    setCurrentStep,
    updateStep
  };
};
