
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

const EnvFileSample = () => {
  const [copied, setCopied] = useState(false);
  
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
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create environment-specific tfvars files in the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">environments/</code> directory
      </p>
      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-medium">environments/prod.tfvars</div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={copyEnvFile}
          >
            <span className="sr-only">Copy</span>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <pre className="text-xs overflow-x-auto p-2 bg-slate-200 dark:bg-slate-900 rounded">
aws_region = "us-west-2"
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
db_max_allocated_storage = 50
# db_password should be provided via CLI or secure method
        </pre>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Note:</strong> For security, provide the database password via command line: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">terraform apply -var="db_password=secure_password"</code>
      </p>
    </div>
  );
};

export default EnvFileSample;
