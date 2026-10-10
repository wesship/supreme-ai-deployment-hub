
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, FileUp } from "lucide-react";
import { Task, AgentResponse } from "@/types/agent";
import { toast } from "sonner";
import { agentApi } from "@/api/agentApi";

interface CreateAgentTabProps {
  taskDescription: string;
  setTaskDescription: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  includeContext: boolean;
  setIncludeContext: (value: boolean) => void;
  userId: string;
  setUserId: (value: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  lastResponse: string | null;
  generating: boolean;
  generateAgent: (task: Task) => Promise<AgentResponse>;
  setActiveTab: (tab: string) => void;
}

const CreateAgentTab: React.FC<CreateAgentTabProps> = ({
  taskDescription,
  setTaskDescription,
  context,
  setContext,
  includeContext,
  setIncludeContext,
  userId,
  setUserId,
  file,
  setFile,
  lastResponse,
  generating,
  generateAgent,
  setActiveTab,
}) => {
  const handleGenerateAgent = async () => {
    if (!taskDescription) {
      toast.error("Please enter a task description");
      return;
    }

    const task: Task = {
      user_id: userId,
      task_description: taskDescription,
      context: includeContext ? context : undefined,
    };

    try {
      await generateAgent(task);
      setActiveTab("manage");
    } catch (error) {
      console.error("Error generating agent:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }
    
    try {
      const token = localStorage.getItem("authToken") || "guest-token";
      await agentApi.uploadTaskFile(file, token);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate New AI Agent</CardTitle>
          <CardDescription>
            Create a new AI agent by providing a task description and optional context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Task Description</Label>
            <Textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe what you want the AI agent to do..."
              rows={4}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeContext"
              checked={includeContext}
              onCheckedChange={(checked) => 
                setIncludeContext(checked === true)}
            />
            <Label htmlFor="includeContext">Include additional context</Label>
          </div>
          {includeContext && (
            <div className="space-y-2">
              <Label htmlFor="context">Additional Context</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Provide any additional context..."
                rows={3}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fileUpload">Upload Task File (Optional)</Label>
            <Input 
              id="fileUpload" 
              type="file" 
              onChange={handleFileChange} 
            />
            {file && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleUploadFile}
                className="mt-2"
              >
                <FileUp className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGenerateAgent}
            disabled={!taskDescription || generating}
            className="w-full"
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Generating Agent..." : "Generate AI Agent"}
          </Button>
        </CardFooter>
      </Card>

      {lastResponse && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Response</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              <pre className="whitespace-pre-wrap">{lastResponse}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateAgentTab;
