import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, FileUp, Cloud, FolderOpen, Box, FileText, Github, Link as LinkIcon } from "lucide-react";
import { Task, AgentResponse } from "@/types/agent";
import { toast } from "sonner";
import { agentApi } from "@/api/agentApi";
import { supabase } from "@/integrations/supabase/client";

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

const googleDriveScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const upcomingSources = [
  { label: "OneDrive", icon: Cloud },
  { label: "Dropbox", icon: Box },
  { label: "Notion", icon: FileText },
  { label: "Confluence", icon: FileText },
  { label: "GitHub Repository", icon: Github },
  { label: "URL", icon: LinkIcon },
];

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
  const [driveConnecting, setDriveConnecting] = useState(false);

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

  const handleConnectGoogleDrive = async () => {
    setDriveConnecting(true);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: googleDriveScopes,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        const message = error.message || "Google Drive authorization failed";
        if (message.toLowerCase().includes("unsupported provider") || message.toLowerCase().includes("not enabled")) {
          toast.error("Google OAuth is not enabled in Supabase yet. Enable Google provider so each user can connect their own Drive account.");
        } else {
          toast.error(message);
        }
        setDriveConnecting(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Drive authorization failed";
      toast.error(message);
      setDriveConnecting(false);
    }
  };

  const handleComingSoon = (source: string) => {
    toast.info(`${source} connector is planned. Google Drive and local uploads are the active sources for this release.`);
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
          <div className="space-y-3">
            <div>
              <Label>Upload Knowledge Source</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Each user connects their own account. D3VONN does not reuse the founder's Drive files.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium hover:bg-muted/40">
                <FolderOpen className="h-4 w-4" />
                Local Device
                <Input 
                  id="fileUpload" 
                  type="file" 
                  onChange={handleFileChange}
                  className="sr-only" 
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={handleConnectGoogleDrive}
                disabled={driveConnecting}
                className="min-h-12 justify-center"
              >
                {driveConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                {driveConnecting ? "Connecting..." : "Google Drive"}
              </Button>
              {upcomingSources.map(({ label, icon: Icon }) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  onClick={() => handleComingSoon(label)}
                  className="min-h-12 justify-center opacity-75"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
            {file && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">Selected file: <span className="font-medium text-foreground">{file.name}</span></p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleUploadFile}
                  className="mt-2"
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              </div>
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
