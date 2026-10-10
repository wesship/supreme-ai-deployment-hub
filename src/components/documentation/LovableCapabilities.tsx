import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Code, 
  Database, 
  Cloud, 
  GitBranch, 
  Search, 
  Image, 
  Download, 
  BarChart3,
  Zap,
  Settings,
  Shield,
  Workflow
} from 'lucide-react';

const LovableCapabilities = () => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Lovable AI Capabilities for Supreme AI Deployment Hub
        </CardTitle>
        <CardDescription>
          Complete overview of AI functions, tools, and capabilities for your deployment platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          
          <AccordionItem value="core-purpose">
            <AccordionTrigger>Core Purpose & Mission</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  I am Lovable, an AI editor specialized in building and maintaining your Supreme AI Deployment Hub - 
                  a comprehensive platform for managing AI agent deployments, cloud infrastructure, and development workflows.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Primary Functions</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Build deployment management interfaces</li>
                      <li>• Create cloud infrastructure tools</li>
                      <li>• Develop agent orchestration systems</li>
                      <li>• Implement monitoring dashboards</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Technology Stack</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">React</Badge>
                      <Badge variant="secondary">TypeScript</Badge>
                      <Badge variant="secondary">Tailwind CSS</Badge>
                      <Badge variant="secondary">Supabase</Badge>
                      <Badge variant="secondary">shadcn/ui</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="deployment-tools">
            <AccordionTrigger>
              <Cloud className="h-4 w-4 mr-2" />
              Deployment & Cloud Management Tools
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Deployment Context Management
                    </h4>
                    <ul className="text-sm space-y-1">
                      <li>• Multi-environment deployment tracking</li>
                      <li>• Real-time progress monitoring</li>
                      <li>• Step-by-step deployment orchestration</li>
                      <li>• Rollback and recovery capabilities</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      Cloud Provider Integration
                    </h4>
                    <ul className="text-sm space-y-1">
                      <li>• AWS SDK integration</li>
                      <li>• Azure and GCP support</li>
                      <li>• Kubernetes cluster management</li>
                      <li>• Custom cloud provider adapters</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="development-tools">
            <AccordionTrigger>
              <Code className="h-4 w-4 mr-2" />
              Development & Code Management Tools
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">File Operations</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>lov-view</code> - Read file contents</li>
                      <li>• <code>lov-write</code> - Create/overwrite files</li>
                      <li>• <code>lov-line-replace</code> - Targeted edits</li>
                      <li>• <code>lov-rename</code> - Rename files</li>
                      <li>• <code>lov-delete</code> - Remove files</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Code Search</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>lov-search-files</code> - Regex search</li>
                      <li>• File pattern filtering</li>
                      <li>• Context-aware searching</li>
                      <li>• Case-sensitive options</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Package Management</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>lov-add-dependency</code></li>
                      <li>• <code>lov-remove-dependency</code></li>
                      <li>• NPM package integration</li>
                      <li>• Version management</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="agent-management">
            <AccordionTrigger>
              <Bot className="h-4 w-4 mr-2" />
              AI Agent Management
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Specialized tools for managing your AI agent ecosystem within the deployment hub.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Agent Operations</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Agent state management</li>
                      <li>• Memory system integration</li>
                      <li>• Tool availability tracking</li>
                      <li>• Skill extraction and analysis</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Deployment Orchestration</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Step execution workflows</li>
                      <li>• Environment validation</li>
                      <li>• Rollback handling</li>
                      <li>• Process monitoring</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="monitoring-debugging">
            <AccordionTrigger>
              <BarChart3 className="h-4 w-4 mr-2" />
              Monitoring & Debugging Tools
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Real-time Debugging</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>lov-read-console-logs</code> - Console monitoring</li>
                      <li>• <code>lov-read-network-requests</code> - API tracking</li>
                      <li>• Error classification and handling</li>
                      <li>• Performance monitoring</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Analytics & Insights</h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>analytics--read_project_analytics</code></li>
                      <li>• Usage pattern analysis</li>
                      <li>• Deployment success metrics</li>
                      <li>• Performance dashboards</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="integration-tools">
            <AccordionTrigger>
              <Workflow className="h-4 w-4 mr-2" />
              Integration & External Tools
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Git Integration
                    </h4>
                    <ul className="text-sm space-y-1">
                      <li>• Repository management</li>
                      <li>• Branch operations</li>
                      <li>• Commit handling</li>
                      <li>• GitHub sync</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Web Integration
                    </h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>websearch--web_search</code></li>
                      <li>• <code>lov-fetch-website</code></li>
                      <li>• <code>lov-download-to-repo</code></li>
                      <li>• Content extraction</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Visual Tools
                    </h4>
                    <ul className="text-sm space-y-1">
                      <li>• <code>imagegen--generate_image</code></li>
                      <li>• <code>imagegen--edit_image</code></li>
                      <li>• Asset management</li>
                      <li>• UI enhancement</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recovery-security">
            <AccordionTrigger>
              <Shield className="h-4 w-4 mr-2" />
              Recovery & Security Features
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Disaster Recovery</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Recovery point management</li>
                      <li>• Recovery plan execution</li>
                      <li>• Resource state tracking</li>
                      <li>• Target override capabilities</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Security & Validation</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Environment readiness checks</li>
                      <li>• Configuration validation</li>
                      <li>• Access control integration</li>
                      <li>• Secure deployment practices</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="limitations">
            <AccordionTrigger>
              <Zap className="h-4 w-4 mr-2" />
              Capabilities & Limitations
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                    <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">What I Can Do</h4>
                    <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
                      <li>• Build complete React web applications</li>
                      <li>• Create responsive deployment dashboards</li>
                      <li>• Implement real-time monitoring</li>
                      <li>• Design cloud management interfaces</li>
                      <li>• Integrate with Supabase backend</li>
                      <li>• Generate and edit images</li>
                      <li>• Manage Git repositories</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                    <h4 className="font-medium mb-2 text-orange-800 dark:text-orange-200">Current Limitations</h4>
                    <ul className="text-sm space-y-1 text-orange-700 dark:text-orange-300">
                      <li>• Cannot run backend code (Python, Node.js)</li>
                      <li>• Limited to React ecosystem</li>
                      <li>• No direct database modifications</li>
                      <li>• Cannot modify package.json directly</li>
                      <li>• No native mobile app development</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
    </Card>
  );
};

export default LovableCapabilities;