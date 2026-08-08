
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitGraph, Terminal, LineChart, RefreshCw, CheckCircle2, XCircle, Clock, Plus, Save, Play } from "lucide-react";
import { toast } from "sonner";
import { agentApi } from "@/api/agentApi";
import { Agent, DAGWorkflow, DAGStep } from "@/types/agent";
import * as yaml from 'js-yaml';

interface WorkflowTabProps {
  yamlDAG: string;
  setYamlDAG: (yaml: string) => void;
  dagResponse: any;
  setDagResponse: (response: any) => void;
  logMessages: string[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  yaml: string;
}

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "research",
    name: "Research Pipeline",
    description: "A workflow for researching, summarizing, and formatting information",
    yaml: `workflow_name: research_pipeline
workflow_description: Research, summarize and format information
memory_enabled: true
max_concurrent_steps: 2
steps:
  - agent: ResearchFetcher
    input: "Research the latest advancements in AI agents"
  - agent: Summarizer
    input: "Summarize the key findings from the research"
    depends_on: ResearchFetcher
    tools: [text_processor]
  - agent: Formatter
    input: "Format the summary into a professional report"
    depends_on: Summarizer
    tools: [document_generator]
    expected_output: "A well-formatted PDF report"
    retry_count: 2`
  },
  {
    id: "coding",
    name: "Code Generation Pipeline",
    description: "Generate, review, and test code",
    yaml: `workflow_name: code_development
workflow_description: Generate, review and test code
memory_enabled: true
max_concurrent_steps: 2
steps:
  - agent: CodeGenerator
    input: "Write a React component that displays a user profile"
    tools: [code_editor]
  - agent: CodeReviewer
    input: "Review the code for best practices and potential issues"
    depends_on: CodeGenerator
  - agent: TestWriter
    input: "Write tests for the component"
    depends_on: CodeGenerator
    tools: [test_runner]
  - agent: DocumentationWriter
    input: "Write documentation for the component"
    depends_on: [CodeGenerator, CodeReviewer]
    expected_output: "Complete documentation with examples"
    fallback:
      agent: SimpleDocGenerator
      input: "Generate basic documentation from the code"`
  },
  {
    id: "content",
    name: "Content Creation",
    description: "Create, edit, and publish content",
    yaml: `workflow_name: content_creation
workflow_description: Create, edit and publish content
memory_enabled: true
steps:
  - agent: ContentPlanner
    input: "Plan a blog post about AI agents"
  - agent: ContentWriter
    input: "Write the blog post based on the plan"
    depends_on: ContentPlanner
  - agent: ContentEditor
    input: "Edit the blog post for grammar and clarity"
    depends_on: ContentWriter
    tools: [grammar_checker]
  - agent: SEOOptimizer
    input: "Optimize the content for search engines"
    depends_on: ContentEditor
    expected_output: "SEO-optimized blog post ready for publication"
    timeout_ms: 30000`
  }
];

const WorkflowTab: React.FC<WorkflowTabProps> = ({
  yamlDAG,
  setYamlDAG,
  dagResponse,
  setDagResponse,
  logMessages,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState<string>("");
  const [workflowDesc, setWorkflowDesc] = useState<string>("");
  const [enableMemory, setEnableMemory] = useState<boolean>(false);
  const [maxConcurrent, setMaxConcurrent] = useState<number>(1);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [statusPollingId, setStatusPollingId] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [visualizerMode, setVisualizerMode] = useState<"yaml" | "visual">("yaml");
  const [steps, setSteps] = useState<DAGStep[]>([]);
  const [showStepDialog, setShowStepDialog] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<DAGStep | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingAgents(true);
      try {
        const response = await agentApi.listAgents();
        setAgents(response.agents);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        toast.error("Failed to load agents");
      } finally {
        setLoadingAgents(false);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    if (yamlDAG) {
      try {
        const parsed = yaml.load(yamlDAG) as DAGWorkflow;
        if (parsed) {
          setWorkflowName(parsed.workflow_name || "");
          setWorkflowDesc(parsed.workflow_description || "");
          setEnableMemory(parsed.memory_enabled || false);
          setMaxConcurrent(parsed.max_concurrent_steps || 1);
          setSteps(parsed.steps || []);
        }
      } catch (error) {
        console.error("Invalid YAML:", error);
      }
    }
  }, [yamlDAG]);

  useEffect(() => {
    if (visualizerMode === "visual") {
      const workflow: DAGWorkflow = {
        workflow_name: workflowName,
        workflow_description: workflowDesc,
        steps,
        memory_enabled: enableMemory,
        max_concurrent_steps: maxConcurrent
      };
      try {
        const newYaml = yaml.dump(workflow);
        setYamlDAG(newYaml);
      } catch (error) {
        console.error("Error generating YAML:", error);
      }
    }
  }, [workflowName, workflowDesc, steps, enableMemory, maxConcurrent, visualizerMode, setYamlDAG]);

  useEffect(() => {
    return () => {
      if (statusPollingId) clearInterval(statusPollingId);
    };
  }, [statusPollingId]);

  const startStatusPolling = (workflowId: string) => {
    setIsPolling(true);
    const pollingId = window.setInterval(async () => {
      try {
        const status = await agentApi.getWorkflowStatus(workflowId);
        setDagResponse(status);
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(pollingId);
          setStatusPollingId(null);
          setIsPolling(false);
          status.status === "completed" ? toast.success("Workflow completed successfully") : toast.error("Workflow failed");
        }
      } catch (error) {
        console.error("Error polling workflow status:", error);
        clearInterval(pollingId);
        setStatusPollingId(null);
        setIsPolling(false);
        toast.error("Failed to get workflow status");
      }
    }, 3000);
    setStatusPollingId(pollingId);
  };

  const handleSubmitDAG = async () => {
    try {
      const parsedDAG = yaml.load(yamlDAG);
      const response = await agentApi.submitDAG(parsedDAG as DAGWorkflow);
      setDagResponse(response);
      if (response.workflow_id) {
        toast.success("DAG workflow submitted successfully");
        setWorkflowStatus("running");
        startStatusPolling(response.workflow_id);
      }
    } catch (error: any) {
      console.error("Error submitting DAG:", error);
      setDagResponse({ error: error.message || 'Invalid YAML or server error' });
      toast.error("Failed to submit DAG workflow");
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = workflowTemplates.find(t => t.id === templateId);
    if (template) {
      setYamlDAG(template.yaml);
      setSelectedWorkflowId(templateId);
      toast.success(`Applied "${template.name}" template`);
    }
  };

  const openAddStepDialog = () => {
    setCurrentStep({ agent: "", input: "" });
    setShowStepDialog(true);
  };

  const openEditStepDialog = (index: number) => {
    setCurrentStep({ ...steps[index] });
    setShowStepDialog(true);
  };

  const handleSaveStep = () => {
    if (!currentStep || !currentStep.agent) {
      toast.error("Agent is required");
      return;
    }
    const matchingIndex = steps.findIndex(
      step => step.agent === currentStep.agent && step.input === currentStep.input
    );
    if (matchingIndex === -1) setSteps([...steps, currentStep]);
    else {
      const next = [...steps];
      next[matchingIndex] = currentStep;
      setSteps(next);
    }
    setShowStepDialog(false);
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "text-gray-500";
    switch (status) {
      case "running": return "text-blue-500";
      case "completed": return "text-green-500";
      case "failed": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return <Clock className="h-5 w-5" />;
    switch (status) {
      case "running": return <RefreshCw className="h-5 w-5 animate-spin" />;
      case "completed": return <CheckCircle2 className="h-5 w-5" />;
      case "failed": return <XCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="workflow">Workflow Builder</TabsTrigger>
          <TabsTrigger value="results">Results & Logs</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GitGraph className="h-5 w-5" />DAG Workflow Builder</CardTitle>
              <CardDescription>Create and submit agent workflows using YAML or visual builder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <Tabs value={visualizerMode} onValueChange={(v) => setVisualizerMode(v as "yaml" | "visual")} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
                    <TabsTrigger value="visual">Visual Builder</TabsTrigger>
                  </TabsList>
                </Tabs>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleSubmitDAG} disabled={isPolling}>
                        {isPolling ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Workflow
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Submit the workflow to be executed</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {visualizerMode === "yaml" ? (
                <div className="space-y-2">
                  <Label htmlFor="yamlEditor">YAML Configuration</Label>
                  <Textarea id="yamlEditor" value={yamlDAG} onChange={(e) => setYamlDAG(e.target.value)} placeholder="Enter DAG in YAML format..." rows={15} className="font-mono text-sm" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="workflowName">Workflow Name</Label><Input id="workflowName" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="research_pipeline" /></div>
                    <div className="space-y-2"><Label htmlFor="maxConcurrent">Max Concurrent Steps</Label><Input id="maxConcurrent" type="number" min={1} max={10} value={maxConcurrent} onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 1)} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="workflowDesc">Workflow Description</Label><Textarea id="workflowDesc" value={workflowDesc} onChange={(e) => setWorkflowDesc(e.target.value)} placeholder="Describe the workflow purpose..." rows={2} /></div>
                  <div className="flex items-center space-x-2"><Switch id="enableMemory" checked={enableMemory} onCheckedChange={setEnableMemory} /><Label htmlFor="enableMemory">Enable Workflow Memory</Label></div>
                  <Separator className="my-2" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center"><Label>Workflow Steps</Label><Button size="sm" variant="outline" onClick={openAddStepDialog}><Plus className="h-4 w-4 mr-1" /> Add Step</Button></div>
                    <ScrollArea className="h-[250px] w-full rounded-md border p-4">
                      {steps.length > 0 ? (
                        <div className="space-y-2">
                          {steps.map((step, index) => (
                            <Card key={index} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">Step {index + 1}: <span className="text-primary">{step.agent}</span></h4>
                                  <p className="text-sm text-muted-foreground">{step.input}</p>
                                  {step.depends_on && <div className="mt-1 text-xs"><span className="font-medium">Depends on:</span> {Array.isArray(step.depends_on) ? step.depends_on.join(', ') : step.depends_on}</div>}
                                  {step.tools && step.tools.length > 0 && <div className="mt-1 text-xs"><span className="font-medium">Tools:</span> {step.tools.join(', ')}</div>}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => openEditStepDialog(index)}>Edit</Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center"><p className="text-muted-foreground">No steps defined yet</p><Button variant="link" size="sm" onClick={openAddStepDialog}>Add your first step</Button></div>
                      )}
                    </ScrollArea>
                  </div>
                  <div className="pt-2"><Label className="text-xs text-muted-foreground">Generated YAML:</Label><ScrollArea className="h-[100px] w-full rounded-md border bg-muted p-2 mt-1"><pre className="text-xs font-mono">{yamlDAG}</pre></ScrollArea></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{steps.includes(currentStep as DAGStep) ? "Edit Step" : "Add Step"}</DialogTitle><DialogDescription>Configure the workflow step details</DialogDescription></DialogHeader>
              {currentStep && (
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label htmlFor="stepAgent">Agent</Label><Select value={currentStep.agent} onValueChange={(value) => setCurrentStep({ ...currentStep, agent: value })}><SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.name}>{agent.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="stepInput">Input</Label><Textarea id="stepInput" value={currentStep.input || ""} onChange={(e) => setCurrentStep({ ...currentStep, input: e.target.value })} placeholder="What should the agent do?" /></div>
                  <div className="space-y-2"><Label htmlFor="stepDependsOn">Depends On (Optional)</Label><Input id="stepDependsOn" value={Array.isArray(currentStep.depends_on) ? currentStep.depends_on.join(", ") : currentStep.depends_on || ""} onChange={(e) => { const value = e.target.value; setCurrentStep({ ...currentStep, depends_on: value.includes(",") ? value.split(",").map(s => s.trim()).filter(Boolean) : value.trim() || undefined }); }} placeholder="Agent name or comma-separated list" /></div>
                  <div className="space-y-2"><Label htmlFor="stepTools">Tools (Optional)</Label><Input id="stepTools" value={currentStep.tools?.join(", ") || ""} onChange={(e) => { const value = e.target.value; setCurrentStep({ ...currentStep, tools: value ? value.split(",").map(s => s.trim()).filter(Boolean) : undefined }); }} placeholder="Comma-separated list of tools" /></div>
                  <div className="space-y-2"><Label htmlFor="stepExpectedOutput">Expected Output (Optional)</Label><Input id="stepExpectedOutput" value={currentStep.expected_output || ""} onChange={(e) => setCurrentStep({ ...currentStep, expected_output: e.target.value || undefined })} placeholder="What should this step produce?" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="stepTimeout">Timeout (ms, Optional)</Label><Input id="stepTimeout" type="number" value={currentStep.timeout_ms || ""} onChange={(e) => setCurrentStep({ ...currentStep, timeout_ms: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="30000" /></div>
                    <div className="space-y-2"><Label htmlFor="stepRetry">Retry Count (Optional)</Label><Input id="stepRetry" type="number" min={0} max={5} value={currentStep.retry_count || ""} onChange={(e) => setCurrentStep({ ...currentStep, retry_count: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="1" /></div>
                  </div>
                </div>
              )}
              <DialogFooter><Button variant="outline" onClick={() => setShowStepDialog(false)}>Cancel</Button><Button onClick={handleSaveStep}><Save className="mr-2 h-4 w-4" />Save Step</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="results">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Workflow Response</CardTitle><div className="flex items-center space-x-2"><span className="text-sm">Status:</span><span className={`flex items-center text-sm ${getStatusColor(workflowStatus)}`}>{getStatusIcon(workflowStatus)}<span className="ml-1 capitalize">{workflowStatus || "Not started"}</span></span></div></CardHeader>
              <CardContent>{dagResponse ? <ScrollArea className="h-[300px] w-full rounded-md border p-4"><pre className="whitespace-pre-wrap font-mono text-sm">{JSON.stringify(dagResponse, null, 2)}</pre></ScrollArea> : <div className="text-center p-4 text-muted-foreground">Submit a workflow to see the response here</div>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Real-Time Agent Logs</CardTitle></CardHeader>
              <CardContent><ScrollArea className="h-[300px] w-full rounded-md border bg-black p-4"><div className="font-mono text-sm text-green-400">{logMessages.length > 0 ? logMessages.map((msg, idx) => <div key={idx}>{msg}</div>) : <div className="text-gray-500">Waiting for log messages...</div>}</div></ScrollArea></CardContent>
              <CardFooter><Button variant="outline" className="w-full" onClick={() => setDagResponse(null)}>Clear Results</Button></CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid md:grid-cols-3 gap-4">
            {workflowTemplates.map((template) => (
              <Card key={template.id} className={`cursor-pointer transition-all ${selectedWorkflowId === template.id ? 'ring-2 ring-primary' : ''}`} onClick={() => handleApplyTemplate(template.id)}>
                <CardHeader><CardTitle>{template.name}</CardTitle><CardDescription>{template.description}</CardDescription></CardHeader>
                <CardContent><ScrollArea className="h-[100px] w-full"><pre className="text-xs font-mono whitespace-pre-wrap opacity-70">{template.yaml}</pre></ScrollArea></CardContent>
                <CardFooter><Button variant={selectedWorkflowId === template.id ? "default" : "outline"} className="w-full" onClick={(e) => { e.stopPropagation(); handleApplyTemplate(template.id); }}>{selectedWorkflowId === template.id ? "Selected" : "Use Template"}</Button></CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowTab;
