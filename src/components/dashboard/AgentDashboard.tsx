
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Play, Trash, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Mock data (replace with actual API calls)
const mockAgents = [
  { id: 1, name: 'Email Assistant', status: 'idle', lastRun: '2023-06-15 14:30' },
  { id: 2, name: 'Calendar Manager', status: 'active', lastRun: '2023-06-16 09:45' },
  { id: 3, name: 'Customer Support', status: 'error', lastRun: '2023-06-14 11:20' },
];

const mockLogs = [
  { id: 1, agentId: 1, message: 'Processed 5 new emails', timestamp: '2023-06-15 14:30:45' },
  { id: 2, agentId: 1, message: 'Added 3 tasks to todo list', timestamp: '2023-06-15 14:31:12' },
  { id: 3, agentId: 2, message: 'Updated meeting with John to 3 PM', timestamp: '2023-06-16 09:45:23' },
  { id: 4, agentId: 3, message: 'ERROR: Failed to connect to CRM API', timestamp: '2023-06-14 11:20:18' },
];

const AgentDashboard = () => {
  const [agents, setAgents] = useState(mockAgents);
  const [logs, setLogs] = useState(mockLogs);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchAgents = () => {
    // Replace with actual API call
    setIsLoading(true);
    setTimeout(() => {
      setAgents(mockAgents);
      setIsLoading(false);
    }, 500);
  };
  
  useEffect(() => {
    fetchAgents();
  }, []);
  
  const handleRunAgent = (id: number) => {
    toast.success(`Started agent #${id}`);
    // Replace with actual API call
  };
  
  const handleDeleteAgent = (id: number) => {
    toast.success(`Deleted agent #${id}`);
    // Replace with actual API call
    setAgents(agents.filter(agent => agent.id !== id));
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Agent Overview</CardTitle>
            <CardDescription>Manage your deployed agents</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAgents}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(agent => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        agent.status === 'active' ? 'default' : 
                        agent.status === 'error' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{agent.lastRun}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRunAgent(agent.id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteAgent(agent.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Agent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full">
            <div className="space-y-2 p-1">
              {logs.map(log => (
                <div 
                  key={log.id} 
                  className={`p-3 rounded-md text-sm ${
                    log.message.includes('ERROR') 
                      ? 'bg-red-500/10 text-red-500' 
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">
                      Agent #{log.agentId}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="mt-1">{log.message}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDashboard;
