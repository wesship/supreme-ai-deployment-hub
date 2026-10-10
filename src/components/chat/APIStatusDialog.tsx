
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface APIConfig {
  name: string;
  endpoint: string;
  isConnected: boolean;
}

interface APIStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiConfigs: APIConfig[];
  onManageAPI: () => void;
}

const APIStatusDialog: React.FC<APIStatusDialogProps> = ({
  open,
  onOpenChange,
  apiConfigs,
  onManageAPI
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>API Connection Status</DialogTitle>
          <DialogDescription>
            Manage your external API connections
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {apiConfigs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No API connections configured</p>
              <Button 
                variant="outline" 
                onClick={onManageAPI} 
                className="mt-2"
              >
                Add API Connection
              </Button>
            </div>
          ) : (
            <>
              {apiConfigs.map((api) => (
                <div key={api.name} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{api.name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{api.endpoint}</p>
                  </div>
                  <div>
                    {api.isConnected ? (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full">
                        Connected
                      </span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded-full">
                        Disconnected
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <Button onClick={onManageAPI} className="w-full mt-2">
                Manage API Connections
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default APIStatusDialog;
