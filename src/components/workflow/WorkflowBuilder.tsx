import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Workflow, WorkflowNode } from '@/types/workflow';
import { Play, Save, Settings, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  onExecute?: (workflow: Workflow) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow,
  onSave,
  onExecute
}) => {
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow>(
    workflow || {
      id: '',
      name: 'New Workflow',
      active: false,
      nodes: [],
      connections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'custom'
    }
  );

  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  const nodeTypes = [
    { type: 'webhook', name: 'Webhook', icon: '🔗', category: 'trigger' },
    { type: 'http', name: 'HTTP Request', icon: '🌐', category: 'action' },
    { type: 'openai', name: 'OpenAI', icon: '🤖', category: 'ai' },
    { type: 'slack', name: 'Slack', icon: '💬', category: 'communication' },
    { type: 'email', name: 'Email', icon: '📧', category: 'communication' },
    { type: 'kubernetes', name: 'Kubernetes', icon: '⚡', category: 'deployment' },
    { type: 'docker', name: 'Docker', icon: '🐳', category: 'deployment' },
    { type: 'aws', name: 'AWS', icon: '☁️', category: 'cloud' },
    { type: 'condition', name: 'Condition', icon: '🔀', category: 'logic' },
    { type: 'transform', name: 'Transform', icon: '🔄', category: 'data' }
  ];

  const addNode = useCallback((type: string) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      name: nodeTypes.find(nt => nt.type === type)?.name || type,
      parameters: {},
      position: { 
        x: 100 + (currentWorkflow.nodes.length * 200), 
        y: 100 + (Math.floor(currentWorkflow.nodes.length / 4) * 150) 
      }
    };

    setCurrentWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      updatedAt: new Date().toISOString()
    }));

    toast.success(`Added ${newNode.name} node`);
  }, [currentWorkflow.nodes.length, nodeTypes]);

  const removeNode = useCallback((nodeId: string) => {
    setCurrentWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c => c.source !== nodeId && c.target !== nodeId),
      updatedAt: new Date().toISOString()
    }));
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }

    toast.success('Node removed');
  }, [selectedNode]);

  const handleSave = useCallback(() => {
    const updatedWorkflow = {
      ...currentWorkflow,
      updatedAt: new Date().toISOString()
    };
    
    setCurrentWorkflow(updatedWorkflow);
    onSave?.(updatedWorkflow);
    toast.success('Workflow saved');
  }, [currentWorkflow, onSave]);

  const handleExecute = useCallback(() => {
    if (currentWorkflow.nodes.length === 0) {
      toast.error('Add nodes to execute workflow');
      return;
    }
    
    onExecute?.(currentWorkflow);
    toast.success('Workflow execution started');
  }, [currentWorkflow, onExecute]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Node Palette */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-sm">Node Palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {['trigger', 'action', 'ai', 'communication', 'deployment', 'cloud', 'logic', 'data'].map(category => (
            <div key={category}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {nodeTypes
                  .filter(node => node.category === category)
                  .map(node => (
                    <Button
                      key={node.type}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8"
                      onClick={() => addNode(node.type)}
                    >
                      <span className="mr-2">{node.icon}</span>
                      {node.name}
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Workflow Canvas */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-sm">{currentWorkflow.name}</CardTitle>
              <Badge variant={currentWorkflow.active ? 'default' : 'secondary'}>
                {currentWorkflow.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" onClick={handleExecute}>
                <Play className="h-4 w-4 mr-1" />
                Execute
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-muted rounded-lg min-h-96 p-4 relative overflow-auto">
            {currentWorkflow.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Plus className="h-8 w-8 mx-auto mb-2" />
                  <p>Add nodes from the palette to build your workflow</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {currentWorkflow.nodes.map((node, index) => (
                  <div key={node.id} className="flex items-center space-x-2">
                    <div 
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedNode?.id === node.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedNode(node)}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {nodeTypes.find(nt => nt.type === node.type)?.icon}
                        </span>
                        <div>
                          <h4 className="font-medium text-sm">{node.name}</h4>
                          <p className="text-xs text-muted-foreground">{node.type}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeNode(node.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {index < currentWorkflow.nodes.length - 1 && (
                      <div className="w-8 h-px bg-muted-foreground/30" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Node Properties */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-sm">Node Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Node Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {nodeTypes.find(nt => nt.type === selectedNode.type)?.icon}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{selectedNode.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedNode.type}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium text-sm mb-2">Configuration</h4>
                <div className="text-xs text-muted-foreground">
                  <p>Node configuration options will be available here based on the selected node type.</p>
                  <p className="mt-2">Common settings:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Name and description</li>
                    <li>Input parameters</li>
                    <li>Output settings</li>
                    <li>Error handling</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Settings className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Select a node to view its properties</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowBuilder;