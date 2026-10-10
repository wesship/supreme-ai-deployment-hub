import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAGUI } from '@/contexts/agui/AGUIContext';

interface ToolResultDisplayProps {
  toolName: string;
  toolDescription?: string;
  toolInput: Record<string, any>;
}

const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({
  toolName,
  toolDescription,
  toolInput
}) => {
  const { submitToolResult } = useAGUI();
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let parsedResult;
      try {
        // Attempt to parse as JSON if possible
        parsedResult = JSON.parse(result);
      } catch {
        // Otherwise use as string
        parsedResult = result;
      }
      
      await submitToolResult(toolName, parsedResult);
    } catch (error) {
      console.error('Error submitting tool result:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-sm mr-2">Tool</span>
          {toolName}
        </CardTitle>
        {toolDescription && (
          <p className="text-sm text-gray-500">{toolDescription}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-1">Input:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(toolInput, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-1">Result:</h4>
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="Enter tool result (can be JSON or plain text)"
            className="h-32"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !result.trim()}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Result'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ToolResultDisplay;
