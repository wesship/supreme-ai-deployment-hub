
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Server, Power, AlertCircle, HelpCircle } from 'lucide-react';
import { useDeployment } from '@/contexts/DeploymentContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const KubeConfigConnect = () => {
  const [kubeConfig, setKubeConfig] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false);
  const { isConnected, isConnecting, isDeploying, connectToCluster, disconnectFromCluster } = useDeployment();

  const handleConnect = async () => {
    setConnectionError(null);
    try {
      // Track connection start time for performance monitoring
      const startTime = performance.now();
      console.log('Initiating connection to cluster...');

      const success = await connectToCluster(kubeConfig);
      
      const endTime = performance.now();
      console.log(`Connection attempt completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      if (!success) {
        setConnectionError("Failed to connect to the cluster. Please check your kubeconfig and try again.");
        toast.error("Connection failed - Please verify your configuration");
      } else {
        toast.success("Successfully connected to Kubernetes cluster!");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      console.error('Connection error details:', error);
      
      // Provide more user-friendly error message based on common issues
      let userErrorMessage = errorMessage;
      
      if (errorMessage.includes('certificate') || errorMessage.includes('tls')) {
        userErrorMessage = "Certificate validation failed. Your kubeconfig may contain expired or invalid certificates.";
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        userErrorMessage = "Connection timed out. The cluster may be unreachable or behind a firewall.";
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
        userErrorMessage = "Authentication failed. Please check your credentials in the kubeconfig.";
      } else if (errorMessage.includes('parse') || errorMessage.includes('invalid')) {
        userErrorMessage = "Invalid kubeconfig format. Please check your YAML syntax.";
      }

      setConnectionError(userErrorMessage);
      toast.error("Connection error: " + userErrorMessage);
    } finally {
      // Always make sure we're not in a connecting state if something goes wrong
      if (isConnecting) {
        // In a real app this would be handled by the DeploymentContext
        // connectToCluster handles this internally now
      }
    }
  };

  const handleDisconnect = () => {
    disconnectFromCluster();
    setConnectionError(null);
    setKubeConfig('');
    toast.info("Disconnected from Kubernetes cluster");
  };

  const toggleAdvancedHelp = () => {
    setShowAdvancedHelp(!showAdvancedHelp);
  };

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm">Connected to Kubernetes cluster</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isDeploying}>
            <Power className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Connect to your Kubernetes cluster to start deployment
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="p-0 h-auto"
                onClick={toggleAdvancedHelp}
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Need help connecting? Click for tips</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {connectionError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Connection Failed</AlertTitle>
          <AlertDescription className="text-sm">
            {connectionError}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex gap-2 flex-col sm:flex-row">
        <Input
          placeholder="Paste your kubeconfig content or leave blank for local cluster"
          value={kubeConfig}
          onChange={(e) => setKubeConfig(e.target.value)}
          className="flex-1"
          disabled={isConnecting}
        />
        <Button 
          onClick={handleConnect} 
          disabled={isConnecting} 
          className="sm:w-auto w-full"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Server className="mr-2 h-4 w-4" />
              Connect
            </>
          )}
        </Button>
      </div>

      <Accordion 
        type="single" 
        collapsible 
        className="w-full" 
        value={showAdvancedHelp ? 'troubleshooting' : ''}
        onValueChange={(value) => setShowAdvancedHelp(!!value)}
      >
        <AccordionItem value="troubleshooting">
          <AccordionTrigger className="text-sm text-muted-foreground">
            Connection Troubleshooting
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium">Common Connection Issues:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <span className="font-medium">Invalid kubeconfig:</span> Ensure the YAML syntax is correct
                </li>
                <li>
                  <span className="font-medium">Expired certificates:</span> Check certificate validity in your kubeconfig
                </li>
                <li>
                  <span className="font-medium">Network restrictions:</span> Verify the API server is accessible from your location
                </li>
                <li>
                  <span className="font-medium">Local cluster not running:</span> Start your local Kubernetes cluster
                </li>
              </ul>
              
              <p className="font-medium mt-3">For local clusters:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Docker Desktop: Ensure Kubernetes is enabled in settings</li>
                <li>Minikube: Run "minikube start" in your terminal</li>
                <li>Kind: Verify the cluster exists with "kind get clusters"</li>
              </ul>
              
              <p className="font-medium mt-3">For remote clusters:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Use "kubectl config view --raw" to get your kubeconfig content</li>
                <li>Ensure your authentication token has not expired</li>
                <li>Check that your user has appropriate RBAC permissions</li>
              </ul>
              
              <p className="mt-3 italic">
                If problems persist, check your browser console for detailed error logs
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default KubeConfigConnect;
