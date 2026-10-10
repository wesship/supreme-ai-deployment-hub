
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Terminal } from 'lucide-react';

interface DeploymentCommand {
  id: string;
  title: string;
  description: string;
  command: string;
}

interface DeploymentCommandsProps {
  deploymentCommands: DeploymentCommand[];
}

const DeploymentCommands = ({ deploymentCommands }: DeploymentCommandsProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  
  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      {deploymentCommands.map(cmd => (
        <div key={cmd.id} className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-medium">{cmd.title}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => copyCommand(cmd.command, cmd.id)}
            >
              <span className="sr-only">Copy</span>
              {copied === cmd.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{cmd.description}</p>
          <div className="flex items-center bg-slate-200 dark:bg-slate-900 p-1 rounded">
            <Terminal className="h-3 w-3 mr-1 text-muted-foreground" />
            <pre className="text-xs overflow-x-auto flex-1">{cmd.command}</pre>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeploymentCommands;
