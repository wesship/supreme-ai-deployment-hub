import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  PlayCircle, 
  GitBranch, 
  Cloud, 
  Activity,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Terminal,
  Users,
  Shield,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

interface WorkflowRun {
  id: string;
  name: string;
  status: 'success' | 'failure' | 'in_progress' | 'cancelled';
  branch: string;
  commit: string;
  author: string;
  startTime: string;
  duration: string;
  environment: string;
  url: string;
}

interface DeploymentMetrics {
  totalDeployments: number;
  successRate: number;
  avgDuration: string;
  lastDeploy: string;
  activeEnvironments: string[];
}

const WorkflowDashboard: React.FC = () => {
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [metrics, setMetrics] = useState<DeploymentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState('all');

  // Mock data - replace with actual GitHub API calls
  useEffect(() => {
    const fetchWorkflowData = async () => {
      setIsLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockRuns: WorkflowRun[] = [
        {
          id: '1',
          name: 'Terraform Deployment Pipeline',
          status: 'success',
          branch: 'main',
          commit: 'a1b2c3d',
          author: 'john-doe',
          startTime: '2024-01-15T10:30:00Z',
          duration: '4m 32s',
          environment: 'production',
          url: 'https://github.com/wesship/supreme-ai-deployment-hub/actions/runs/123'
        },
        {
          id: '2',
          name: 'Terraform Deployment Pipeline',
          status: 'in_progress',
          branch: 'feature/new-deployment',
          commit: 'e4f5g6h',
          author: 'jane-smith',
          startTime: '2024-01-15T11:15:00Z',
          duration: '2m 18s',
          environment: 'staging',
          url: 'https://github.com/wesship/supreme-ai-deployment-hub/actions/runs/124'
        },
        {
          id: '3',
          name: 'Terraform Deployment Pipeline',
          status: 'failure',
          branch: 'hotfix/security-patch',
          commit: 'i7j8k9l',
          author: 'admin',
          startTime: '2024-01-15T09:45:00Z',
          duration: '1m 52s',
          environment: 'production',
          url: 'https://github.com/wesship/supreme-ai-deployment-hub/actions/runs/125'
        }
      ];

      const mockMetrics: DeploymentMetrics = {
        totalDeployments: 127,
        successRate: 94.5,
        avgDuration: '3m 45s',
        lastDeploy: '2024-01-15T10:30:00Z',
        activeEnvironments: ['production', 'staging', 'development']
      };

      setWorkflowRuns(mockRuns);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    fetchWorkflowData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failure':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failure':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const filteredRuns = selectedEnvironment === 'all' 
    ? workflowRuns 
    : workflowRuns.filter(run => run.environment === selectedEnvironment);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading workflow data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Workflow Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your deployment pipelines
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalDeployments}</div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.successRate}%</div>
                <Progress value={metrics.successRate} className="mt-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.avgDuration}</div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Environments</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeEnvironments.length}</div>
                <div className="flex gap-1 mt-2">
                  {metrics.activeEnvironments.map((env) => (
                    <Badge key={env} variant="secondary" className="text-xs">
                      {env}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Workflow Runs */}
      <Tabs value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Environments</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="staging">Staging</TabsTrigger>
            <TabsTrigger value="development">Development</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <PlayCircle className="h-4 w-4" />
              Trigger Deployment
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View in GitHub
            </Button>
          </div>
        </div>

        <TabsContent value={selectedEnvironment} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Recent Workflow Runs
              </CardTitle>
              <CardDescription>
                Monitor the status and progress of your deployment pipelines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {filteredRuns.map((run, index) => (
                    <motion.div
                      key={run.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(run.status)}
                          <div>
                            <div className="font-medium">{run.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {run.branch} • {run.commit} • by {run.author}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(run.status)}>
                            {run.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {run.environment}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {run.duration}
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={run.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                      {index < filteredRuns.length - 1 && <Separator />}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2">
              <PlayCircle className="h-4 w-4" />
              Deploy to Staging
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Zap className="h-4 w-4" />
              Deploy to Production
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <AlertTriangle className="h-4 w-4" />
              Rollback Last Deploy
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Secrets Configured</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Branch Protection</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Environment Gates</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">john-doe</span> deployed to production
            </div>
            <div className="text-sm">
              <span className="font-medium">jane-smith</span> created staging environment
            </div>
            <div className="text-sm">
              <span className="font-medium">admin</span> updated security policies
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkflowDashboard;