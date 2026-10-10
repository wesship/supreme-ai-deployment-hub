
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useDeployment } from '@/contexts/DeploymentContext';
import { CloudProvider } from '@/types/deployment';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ProviderSelector = () => {
  const { provider, setCloudProvider, environment, setDeploymentEnvironment } = useDeployment();

  const handleProviderChange = (value: string) => {
    setCloudProvider(value as CloudProvider);
  };

  const handleEnvironmentChange = (value: string) => {
    setDeploymentEnvironment(value as 'development' | 'staging' | 'production');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Cloud Provider</h3>
        <RadioGroup 
          value={provider} 
          onValueChange={handleProviderChange} 
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          <div>
            <RadioGroupItem value="aws" id="aws" className="sr-only" />
            <Label
              htmlFor="aws"
              className={`flex flex-col items-center justify-center border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors ${
                provider === 'aws' ? 'border-primary bg-accent/50' : 'border-muted'
              }`}
            >
              <div className="text-2xl mb-1">AWS</div>
              <span className="text-xs text-muted-foreground">Amazon Web Services</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem value="azure" id="azure" className="sr-only" />
            <Label
              htmlFor="azure"
              className={`flex flex-col items-center justify-center border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors ${
                provider === 'azure' ? 'border-primary bg-accent/50' : 'border-muted'
              }`}
            >
              <div className="text-2xl mb-1">Azure</div>
              <span className="text-xs text-muted-foreground">Microsoft Azure</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem value="gcp" id="gcp" className="sr-only" />
            <Label
              htmlFor="gcp"
              className={`flex flex-col items-center justify-center border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors ${
                provider === 'gcp' ? 'border-primary bg-accent/50' : 'border-muted'
              }`}
            >
              <div className="text-2xl mb-1">GCP</div>
              <span className="text-xs text-muted-foreground">Google Cloud</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem value="custom" id="custom" className="sr-only" />
            <Label
              htmlFor="custom"
              className={`flex flex-col items-center justify-center border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors ${
                provider === 'custom' ? 'border-primary bg-accent/50' : 'border-muted'
              }`}
            >
              <div className="text-2xl mb-1">Custom</div>
              <span className="text-xs text-muted-foreground">Other provider</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Deployment Environment</h3>
        <Select value={environment} onValueChange={handleEnvironmentChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default ProviderSelector;
