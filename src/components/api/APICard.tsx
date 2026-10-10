
import React from 'react';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Trash2, RotateCw } from 'lucide-react';
import { APIConfig } from '@/types/api';

interface APICardProps {
  config: APIConfig;
  testingConnection: string | null;
  onRemove: (name: string) => void;
  onTest: (name: string) => void;
}

const APICard: React.FC<APICardProps> = ({ 
  config, 
  testingConnection, 
  onRemove, 
  onTest 
}) => {
  return (
    <Card key={config.name} className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-md">{config.name}</CardTitle>
            <CardDescription className="line-clamp-1">{config.endpoint}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {config.isConnected ? (
              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="h-3 w-3" />
                Connected
              </span>
            ) : (
              <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <X className="h-3 w-3" />
                Disconnected
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm py-2">
        <p className="line-clamp-2 text-muted-foreground">{config.description}</p>
        {config.lastConnected && (
          <p className="text-xs text-muted-foreground mt-1">
            Last connected: {config.lastConnected.toLocaleString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onRemove(config.name)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </Button>
        <Button 
          size="sm" 
          onClick={() => onTest(config.name)}
          disabled={testingConnection === config.name}
        >
          {testingConnection === config.name ? (
            <>
              <RotateCw className="h-4 w-4 mr-1 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RotateCw className="h-4 w-4 mr-1" />
              Test Connection
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default APICard;
