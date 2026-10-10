import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { agentApi } from '@/api/agentApi';
import { AgentType, Tool } from '@/types/agent';
import { Loader2, Plus, Minus, Brain, Wrench } from 'lucide-react';

const agentTypes: { value: AgentType; label: string; description: string }[] = [
  { 
    value: 'researcher', 
    label: 'Researcher', 
    description: 'Gathers information and data from various sources'
  },
  { 
    value: 'analyst', 
    label: 'Analyst', 
    description: 'Analyzes data and extracts insights'
  },
  { 
    value: 'writer', 
    label: 'Writer', 
    description: 'Generates written content and reports'
  },
  { 
    value: 'coder', 
    label: 'Coder', 
    description: 'Writes and reviews code'
  },
  { 
    value: 'planner', 
    label: 'Planner', 
    description: 'Creates plans and schedules tasks'
  },
  { 
    value: 'executor', 
    label: 'Executor', 
    description: 'Executes specified tasks and workflows'
  },
  { 
    value: 'critic', 
    label: 'Critic', 
    description: 'Evaluates outputs and provides feedback'
  },
  { 
    value: 'custom', 
    label: 'Custom', 
    description: 'Customized agent with specific capabilities'
  }
];

const AgentBuilder = () => {
  const [agentName, setAgentName] = useState('');
  const [agentDesc, setAgentDesc] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('custom');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentCapabilities, setAgentCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState('');
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  
  useEffect(() => {
    const fetchTools = async () => {
      setIsLoadingTools(true);
      try {
        const response = await agentApi.getAgentTools();
        setAvailableTools(response.tools);
      } catch (error) {
        console.error("Failed to fetch tools:", error);
        toast.error("Failed to load available tools");
      } finally {
        setIsLoadingTools(false);
      }
    };
    
    fetchTools();
  }, []);
  
  const handleAddCapability = () => {
    if (newCapability.trim() !== '') {
      setAgentCapabilities([...agentCapabilities, newCapability.trim()]);
      setNewCapability('');
    }
  };
  
  const handleRemoveCapability = (index: number) => {
    setAgentCapabilities(agentCapabilities.filter((_, i) => i !== index));
  };
  
  const handleToolSelection = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId) 
        : [...prev, toolId]
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName) {
      toast.error('Please provide an agent name');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const agent = {
        name: agentName,
        desc: agentDesc,
        type: agentType,
        capabilities: agentCapabilities,
        tools: selectedTools,
        memory_enabled: memoryEnabled
      };
      
      const result = await agentApi.createTypedAgent(agent);
      toast.success(`Agent "${result.name}" created successfully`);
      
      setAgentName('');
      setAgentDesc('');
      setAgentType('custom');
      setAgentCapabilities([]);
      setSelectedTools([]);
      setMemoryEnabled(false);
    } catch (error) {
      toast.error('Failed to create agent');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create Specialized Agent</CardTitle>
        <CardDescription>
          Configure a new AI agent with specific capabilities and tools
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="My Assistant"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agentType">Agent Type</Label>
            <Select 
              value={agentType} 
              onValueChange={(value) => setAgentType(value as AgentType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                {agentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agentDesc">Description</Label>
            <Textarea
              id="agentDesc"
              value={agentDesc}
              onChange={(e) => setAgentDesc(e.target.value)}
              placeholder="Describe what this agent does..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Agent Capabilities</Label>
            <div className="flex space-x-2">
              <Input
                value={newCapability}
                onChange={(e) => setNewCapability(e.target.value)}
                placeholder="Add a capability"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddCapability}
                disabled={newCapability.trim() === ''}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mt-2 space-y-2">
              {agentCapabilities.map((capability, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span>{capability}</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveCapability(index)}
                  >
                    <Minus className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {agentCapabilities.length === 0 && (
                <p className="text-sm text-muted-foreground">No capabilities added yet</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Tools</Label>
            {isLoadingTools ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {availableTools.map((tool) => (
                  <div 
                    key={tool.id} 
                    className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer ${
                      selectedTools.includes(tool.id) ? 'bg-primary/10 border-primary' : ''
                    }`}
                    onClick={() => handleToolSelection(tool.id)}
                  >
                    <Checkbox 
                      checked={selectedTools.includes(tool.id)}
                      onCheckedChange={() => handleToolSelection(tool.id)}
                      id={`tool-${tool.id}`}
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`tool-${tool.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {tool.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                ))}
                {availableTools.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">No tools available</p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="memory-enabled" 
              checked={memoryEnabled}
              onCheckedChange={(checked) => setMemoryEnabled(!!checked)}
            />
            <Label htmlFor="memory-enabled">Enable Agent Memory</Label>
          </div>
          
          <Separator className="my-4" />
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Agent'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AgentBuilder;
