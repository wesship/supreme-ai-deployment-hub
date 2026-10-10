
import React from 'react';
import { SavedAPIResponse } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Copy, Trash } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ResponseItemProps {
  response: SavedAPIResponse;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

const ResponseItem: React.FC<ResponseItemProps> = ({ 
  response, 
  onCopy, 
  onDelete 
}) => {
  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{response.apiName}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              response.method === 'GET' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
              response.method === 'POST' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
              response.method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
              response.method === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {response.method}
            </span>
            <span>{response.endpoint}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(response.timestamp), { addSuffix: true })}
        </span>
      </div>
      
      <Separator />
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className={`text-sm px-2 py-0.5 rounded-md ${
            response.status.startsWith('2') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            Status: {response.status}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onCopy(response.response)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onDelete(response.id)}
            >
              <Trash className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
        
        <div className="bg-secondary rounded-md p-4 overflow-hidden">
          <pre className="font-mono text-sm whitespace-pre-wrap break-words max-h-[200px] overflow-auto">
            {response.response}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ResponseItem;
