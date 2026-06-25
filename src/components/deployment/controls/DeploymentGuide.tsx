
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DeploymentCommands from './DeploymentCommands';
import { deploymentCommandsData } from './deploymentData';

interface DeploymentGuideProps {
  onHideGuide: () => void;
}

const DeploymentGuide = ({ onHideGuide }: DeploymentGuideProps) => {
  const copyEnvFile = () => {
    navigator.clipboard.writeText(`aws_region = "us-west-2"
environment = "prod"
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b"]
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24"]
node_desired_capacity = 2
node_max_capacity = 4
node_min_capacity = 1
node_instance_types = ["t3.medium"]
node_disk_size = 50
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_max_allocated_storage = 50`);
  };

  return (
    <div className="mb-4 space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Deployment Guide</AlertTitle>
        <AlertDescription>
          Follow these steps to deploy D3VONN.IO to your AWS infrastructure:
        </AlertDescription>
      </Alert>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="prerequisites">
          <AccordionTrigger className="text-sm font-medium">
            1. Prerequisites
          </AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc ml-4 text-sm space-y-2">
              <li>AWS Account with appropriate permissions</li>
              <li>AWS CLI installed and configured</li>
              <li>Terraform CLI installed (v1.0+)</li>
              <li>kubectl installed</li>
              <li>Docker installed (for building images)</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="terraform-setup">
          <AccordionTrigger className="text-sm font-medium">
            2. Terraform Infrastructure Setup
          </AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal ml-4 text-sm space-y-2">
              <li>Create an <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">environments</code> directory with environment-specific <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">.tfvars</code> files</li>
              <li>Run Terraform commands in sequence to provision infrastructure</li>
              <li>Retrieve kubeconfig for cluster access</li>
            </ol>
            <div className="mt-3 space-y-2">
              <DeploymentCommands deploymentCommands={deploymentCommandsData.slice(0, 5)} />
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="connect-deploy">
          <AccordionTrigger className="text-sm font-medium">
            3. Connect and Deploy
          </AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal ml-4 text-sm space-y-2">
              <li>Copy your kubeconfig content into the connection field below</li>
              <li>Click "Connect" to establish connection with your cluster</li>
              <li>Use the "Start Deployment" button to begin deploying D3VONN.IO components</li>
              <li>Monitor progress in the Deployment Logs and Timeline sections</li>
            </ol>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="verify">
          <AccordionTrigger className="text-sm font-medium">
            4. Verify Deployment
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm mb-2">After deployment completes successfully:</p>
            <ol className="list-decimal ml-4 text-sm space-y-2">
              <li>Check service status in the monitoring dashboard</li>
              <li>Access D3VONN.IO through the LoadBalancer endpoint (available in deployment outputs)</li>
              <li>Set up DNS records to point to your new infrastructure</li>
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={onHideGuide}>
          <FileCode className="h-3 w-3" /> View Sample Environment File
        </Button>
      </div>
    </div>
  );
};

export default DeploymentGuide;
