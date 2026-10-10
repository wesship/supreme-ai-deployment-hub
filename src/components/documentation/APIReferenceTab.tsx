
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const APIReferenceTab: React.FC = () => {
  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle>API Reference Documentation</CardTitle>
          <CardDescription>Detailed reference for all D3VONN.IO functions and methods</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Visit our <a href="/api" className="text-primary hover:underline">complete API documentation</a> for detailed information on all available endpoints and methods.</p>
          
          <Tabs defaultValue="core">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="core">Core API</TabsTrigger>
              <TabsTrigger value="agent">Agent API</TabsTrigger>
              <TabsTrigger value="memory">Memory API</TabsTrigger>
              <TabsTrigger value="tools">Tools API</TabsTrigger>
            </TabsList>
            
            <TabsContent value="core" className="space-y-4">
              <h3 className="text-lg font-semibold mt-4">Core API Methods</h3>
              <div className="overflow-x-auto mt-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Method</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-mono">generate()</td>
                      <td className="py-2">Generates code based on a prompt</td>
                      <td className="py-2 font-mono text-xs">ai.generate({'{'} prompt: '...' {'}'})</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">enhance()</td>
                      <td className="py-2">Improves existing code</td>
                      <td className="py-2 font-mono text-xs">ai.enhance({'{'} code: '...', instruction: '...' {'}'})</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">explain()</td>
                      <td className="py-2">Analyzes and explains code</td>
                      <td className="py-2 font-mono text-xs">ai.explain({'{'} code: '...' {'}'})</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">debug()</td>
                      <td className="py-2">Identifies and fixes issues</td>
                      <td className="py-2 font-mono text-xs">ai.debug({'{'} code: '...', error: '...' {'}'})</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
            
            <TabsContent value="agent" className="space-y-4">
              <h3 className="text-lg font-semibold mt-4">Agent API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The Agent API allows you to create, manage, and interact with AI agents.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Method</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">Authentication</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-mono">POST /agents/create</td>
                      <td className="py-2">Create a new agent with specified capabilities</td>
                      <td className="py-2">Required</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">GET /agents/{'{agentId}'}</td>
                      <td className="py-2">Get agent details by ID</td>
                      <td className="py-2">Required</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">PUT /agents/{'{agentId}'}</td>
                      <td className="py-2">Update agent configuration</td>
                      <td className="py-2">Required</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">POST /agents/{'{agentId}'}/task</td>
                      <td className="py-2">Assign a new task to the agent</td>
                      <td className="py-2">Required</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
            
            <TabsContent value="memory" className="space-y-4">
              <h3 className="text-lg font-semibold mt-4">Memory API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The Memory API provides access to agent memories and knowledge management.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Method</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">Parameters</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-mono">GET /memory/{'{agentId}'}</td>
                      <td className="py-2">Get all memories for an agent</td>
                      <td className="py-2">agentId (required)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">POST /memory/{'{agentId}'}</td>
                      <td className="py-2">Store new memory for an agent</td>
                      <td className="py-2">agentId (required), content</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">GET /memory/search</td>
                      <td className="py-2">Search memories by content</td>
                      <td className="py-2">query, agentId (optional)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
            
            <TabsContent value="tools" className="space-y-4">
              <h3 className="text-lg font-semibold mt-4">Tools API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The Tools API provides access to various AI tools and utilities.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Tool</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">Endpoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-mono">CodeAnalyzer</td>
                      <td className="py-2">Static code analysis and recommendations</td>
                      <td className="py-2 font-mono">/tools/code/analyze</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">WebSearcher</td>
                      <td className="py-2">Search the web for information</td>
                      <td className="py-2 font-mono">/tools/search</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-mono">ImageAnalyzer</td>
                      <td className="py-2">Analyze and describe images</td>
                      <td className="py-2 font-mono">/tools/image/analyze</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">DataExtractor</td>
                      <td className="py-2">Extract structured data from text</td>
                      <td className="py-2 font-mono">/tools/data/extract</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
          
          <Separator className="my-6" />
          
          <h3 className="text-lg font-semibold mb-4">Authentication</h3>
          <p className="mb-2">All API requests require authentication using an API key. Include your API key in the request headers:</p>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>{"Authorization: Bearer YOUR_API_KEY"}</code>
          </pre>
          
          <h3 className="text-lg font-semibold mt-6 mb-4">Rate Limits</h3>
          <p className="mb-2">API requests are subject to the following rate limits:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Free tier: 100 requests per hour</li>
            <li>Developer tier: 1,000 requests per hour</li>
            <li>Enterprise tier: Custom limits</li>
          </ul>
          <p>Rate limit headers are included in all API responses:</p>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1619172158`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default APIReferenceTab;
