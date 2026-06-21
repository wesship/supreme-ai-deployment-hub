import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Workflow, WorkflowExecution, WorkflowTemplate } from '@/types/workflow';
import { n8nService } from '@/services/workflow/n8nService';
import WorkflowBuilder from './WorkflowBuilder';
import WorkflowTemplates from './WorkflowTemplates';
import { Play, Pause, MoreVertical, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const WorkflowManager: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWorkflows();
    loadExecutions();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await n8nService.getWorkflows();
      setWorkflows(data);
    } catch (error) {
      toast.error('Failed to load workflows');
    }
    setLoading(false);
  };

  const loadExecutions = async () => {
    try {
      const data = await n8nService.getExecutions();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    try {
      if (workflow.id) {
        await n8nService.updateWorkflow(workflow.id, workflow);
        toast.success('Workflow updated');
      } else {
        const newWorkflow = await n8nService.createWorkflow(workflow);
        setWorkflows(prev => [...prev, newWorkflow]);
        toast.success('Workflow created');
      }
      loadWorkflows();
    } catch (error) {
      toast.error('Failed to save workflow');
    }
  };

  const handleExecuteWorkflow = async (workflow: Workflow) => {
    try {
      const execution = await n8nService.executeWorkflow(workflow.id);
      setExecutions(prev => [execution, ...prev]);
      toast.success('Workflow execution started');
    } catch (error) {
      toast.error('Failed to execute workflow');
    }
  };

  const handleUseTemplate = (template: WorkflowTemplate) => {
    const newWorkflow: Workflow = {
      id: '',
      name: template.workflow.name || template.name,
      description: template.description,
      active: false,
      nodes: template.workflow.nodes || [],
      connections: template.workflow.connections || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: template.workflow.category || 'custom',
      tags: []
    };
    setSelectedWorkflow(newWorkflow);
  };

  const getExecutionIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      running: 'secondary',
      waiting: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Workflow Manager</h2>
          <p className="text-muted-foreground">Build, manage, and execute n8n workflows</p>
        </div>
        <Button onClick={() => setSelectedWorkflow(null)}>
          Create New Workflow
        </Button>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workflows">My Workflows</TabsTrigger>
          <TabsTrigger value="builder">Workflow Builder</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map(workflow => (
              <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{workflow.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                    </div>
                    <Badge variant={workflow.active ? 'default' : 'secondary'}>
                      {workflow.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {workflow.nodes.length} nodes
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedWorkflow(workflow)}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleExecuteWorkflow(workflow)}
                        disabled={!workflow.active}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {workflows.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first workflow or use a template to get started
              </p>
              <Button onClick={() => setSelectedWorkflow(null)}>
                Create Workflow
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="builder">
          <WorkflowBuilder
            workflow={selectedWorkflow || undefined}
            onSave={handleSaveWorkflow}
            onExecute={handleExecuteWorkflow}
          />
        </TabsContent>

        <TabsContent value="templates">
          <WorkflowTemplates
            onUseTemplate={handleUseTemplate}
            onSelectTemplate={(template) => {
              handleUseTemplate(template);
              // Switch to builder tab
              const builderTab = document.querySelector('[value="builder"]') as HTMLElement;
              builderTab?.click();
            }}
          />
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {executions.slice(0, 10).map(execution => (
                  <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getExecutionIcon(execution.status)}
                      <div>
                        <p className="font-medium text-sm">
                          {workflows.find(w => w.id === execution.workflowId)?.name || 'Unknown Workflow'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Started: {new Date(execution.startedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(execution.status)}
                      {execution.finishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round((new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {executions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <p>No executions yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowManager;