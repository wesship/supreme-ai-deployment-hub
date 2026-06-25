
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Process {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'failed' | 'completed';
  priority?: string | number;
  cpuUsage?: number;
  memoryUsage?: number;
}

interface ProcessMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processes: Process[];
}

const ProcessMonitorDialog: React.FC<ProcessMonitorDialogProps> = ({
  open,
  onOpenChange,
  processes
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>D3VONN.IO Process Monitor</DialogTitle>
          <DialogDescription>
            Master Control Program (MCP) system processes
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {processes.map((process) => (
            <div key={process.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    process.status === 'running' ? 'bg-green-500' : 
                    process.status === 'completed' ? 'bg-blue-500' :
                    process.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <h4 className="font-medium text-sm">{process.name}</h4>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                  Priority: {process.priority || 'Normal'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">CPU Usage: {Math.round(process.cpuUsage || 0)}%</Label>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${process.cpuUsage || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Memory: {Math.round(process.memoryUsage || 0)} MB</Label>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${Math.min(100, (process.memoryUsage || 0) / 5)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProcessMonitorDialog;
