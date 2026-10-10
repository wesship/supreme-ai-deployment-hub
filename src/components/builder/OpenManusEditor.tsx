
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Check, AlertTriangle } from 'lucide-react';
import { backendService } from '@/services/backendService';

const sampleYaml = `workflow_name: Email Processor
steps:
  read_emails:
    agent: EmailReader
    input: "Read new unread emails"
  
  extract_tasks:
    agent: TaskExtractor
    input: "Extract tasks from the email content"
    depends_on: read_emails
  
  add_to_todo:
    agent: TodoManager
    input: "Add extracted tasks to my todo list"
    depends_on: extract_tasks
`;

const OpenManusEditor = () => {
  const [yaml, setYaml] = useState(sampleYaml);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{valid: boolean, message: string} | null>(null);
  
  const handleValidateYaml = async () => {
    setIsValidating(true);
    try {
      const result = await backendService.validateYaml(yaml);
      setValidationResult(result);
      if (result.valid) {
        toast.success('YAML is valid');
      } else {
        toast.error('YAML validation failed');
      }
    } catch (error) {
      toast.error('Error validating YAML');
      console.error(error);
      setValidationResult({valid: false, message: 'Error connecting to validation service'});
    } finally {
      setIsValidating(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>OpenManus YAML Editor</CardTitle>
        <CardDescription>
          Create workflow DAGs using YAML syntax
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          className="font-mono h-80"
          placeholder="Enter your YAML workflow here..."
        />
        
        {validationResult && (
          <Alert variant={validationResult.valid ? "default" : "destructive"}>
            {validationResult.valid ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {validationResult.valid ? 'Valid YAML' : 'Invalid YAML'}
            </AlertTitle>
            <AlertDescription>
              {validationResult.message}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex space-x-2">
          <Button 
            onClick={handleValidateYaml}
            disabled={isValidating}
            className="flex-1"
          >
            {isValidating ? 'Validating...' : 'Validate YAML'}
          </Button>
          <Button variant="secondary" className="flex-1">
            Run Workflow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OpenManusEditor;
