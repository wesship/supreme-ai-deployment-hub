
import React from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, AlertTriangle } from 'lucide-react';

interface RequestConfigProps {
  endpoint: string;
  onEndpointChange: (endpoint: string) => void;
  requestBody: string;
  onRequestBodyChange: (body: string) => void;
  headers: string;
  onHeadersChange: (headers: string) => void;
  method: string;
}

const RequestConfig: React.FC<RequestConfigProps> = ({
  endpoint,
  onEndpointChange,
  requestBody,
  onRequestBodyChange,
  headers,
  onHeadersChange,
  method
}) => {
  const isGetMethod = method === 'GET';
  
  // Example templates for different content types
  const jsonTemplate = '{\n  "key": "value"\n}';
  const formDataTemplate = 'key1=value1&key2=value2';

  // Check if JSON is valid
  const isValidJson = (json: string): boolean => {
    if (!json.trim()) return true;
    try {
      JSON.parse(json);
      return true;
    } catch (e) {
      return false;
    }
  };

  const isJsonBodyValid = isValidJson(requestBody);
  const isHeadersValid = isValidJson(headers);
  
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <label className="text-sm font-medium mb-2 block">Endpoint URL</label>
        <Input 
          placeholder="https://api.example.com/v1/resource" 
          value={endpoint} 
          onChange={e => onEndpointChange(e.target.value)}
          className="font-mono text-sm"
        />
        {!endpoint && (
          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
            <InfoIcon className="h-3 w-3" /> Endpoint URL is required
          </p>
        )}
      </div>

      <Tabs defaultValue="body" className="w-full">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="body">Request Body</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="body" className="pt-4 space-y-4">
          {isGetMethod && (
            <Alert variant="default" className="bg-muted/50">
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Request body is not applicable for GET requests. Use URL parameters instead.
              </AlertDescription>
            </Alert>
          )}
          
          <Textarea 
            placeholder={jsonTemplate}
            className={`font-mono min-h-[150px] text-sm ${!isJsonBodyValid && !isGetMethod ? 'border-red-500' : ''}`}
            value={requestBody}
            onChange={e => onRequestBodyChange(e.target.value)}
            disabled={isGetMethod}
          />
          
          {!isJsonBodyValid && !isGetMethod && requestBody.trim() && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Invalid JSON format. Please check your request body.
              </AlertDescription>
            </Alert>
          )}
          
          {!isGetMethod && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Example formats:</p>
              <div className="space-y-1">
                <div><strong>JSON:</strong> {jsonTemplate}</div>
                <div><strong>Form Data:</strong> {formDataTemplate}</div>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="headers" className="pt-4">
          <Textarea 
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
            className={`font-mono min-h-[150px] text-sm ${!isHeadersValid ? 'border-red-500' : ''}`}
            value={headers}
            onChange={e => onHeadersChange(e.target.value)}
          />
          
          {!isHeadersValid && headers.trim() && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Invalid JSON format in headers. Please check your syntax.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="mt-2 text-xs text-muted-foreground">
            <p>Common headers:</p>
            <ul className="list-disc list-inside mt-1">
              <li>Content-Type: application/json</li>
              <li>Authorization: Bearer &lt;token&gt;</li>
              <li>Accept: application/json</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default RequestConfig;
