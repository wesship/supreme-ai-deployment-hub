import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCloudCredentials } from '@/hooks/useCloudCredentials';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

interface AWSCredentialsFormProps {
  onSuccess?: () => void;
}

const AWSCredentialsForm: React.FC<AWSCredentialsFormProps> = ({ onSuccess }) => {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const { credentials, isLoading, saveAWSCredentials, validateCredentials, deleteCredentials } = useCloudCredentials();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessKeyId || !secretAccessKey || !region) {
      return;
    }

    const result = await saveAWSCredentials({
      accessKeyId,
      secretAccessKey,
      region,
    });

    if (result) {
      setAccessKeyId('');
      setSecretAccessKey('');
      onSuccess?.();
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete your AWS credentials?')) {
      await deleteCredentials('aws');
    }
  };

  const handleValidate = async () => {
    await validateCredentials('aws');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle>AWS Credentials</CardTitle>
        </div>
        <CardDescription>
          Configure your AWS credentials to enable real EKS cluster deployments
        </CardDescription>
      </CardHeader>
      <CardContent>
        {credentials ? (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                AWS credentials configured for region: <strong>{credentials.region}</strong>
                {credentials.last_validated_at && (
                  <span className="block text-sm text-muted-foreground mt-1">
                    Last validated: {new Date(credentials.last_validated_at).toLocaleString()}
                  </span>
                )}
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button
                onClick={handleValidate}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? 'Validating...' : 'Validate Credentials'}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isLoading}
                variant="destructive"
              >
                Delete Credentials
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your credentials are encrypted and stored securely. They are never exposed to the client.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="accessKeyId">AWS Access Key ID</Label>
              <Input
                id="accessKeyId"
                type="text"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
              <Input
                id="secretAccessKey"
                type="password"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">AWS Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AWS_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Saving...' : 'Save Credentials'}
            </Button>

            <p className="text-xs text-muted-foreground mt-2">
              Need help? Learn how to{' '}
              <a
                href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                create AWS access keys
              </a>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default AWSCredentialsForm;
