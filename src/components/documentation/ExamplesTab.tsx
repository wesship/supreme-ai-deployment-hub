
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ExamplesTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Example Projects</CardTitle>
          <CardDescription>Learn from complete, working examples</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold">Todo App</h3>
              <p className="text-sm text-muted-foreground mb-2">A simple todo application with React and D3VONN.IO</p>
              <a href="#" className="text-primary hover:underline text-sm">View Source</a>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold">E-commerce Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-2">Admin dashboard with data visualization</p>
              <a href="#" className="text-primary hover:underline text-sm">View Source</a>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold">AI Chatbot</h3>
              <p className="text-sm text-muted-foreground mb-2">Responsive chatbot interface with conversation history</p>
              <a href="#" className="text-primary hover:underline text-sm">View Source</a>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold">Form Validation</h3>
              <p className="text-sm text-muted-foreground mb-2">Advanced form with validation and error handling</p>
              <a href="#" className="text-primary hover:underline text-sm">View Source</a>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Code Snippets</CardTitle>
          <CardDescription>Ready-to-use code snippets for common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Authentication System</h3>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
                <code>{`
import { DevonnAI } from 'd3vonn-io';

const authSystem = await ai.generate({
  prompt: 'Create a secure authentication system with JWT',
  framework: 'react',
  includeTests: true
});

console.log(authSystem.files); // List of generated files
                `}</code>
              </pre>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">API Integration</h3>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
                <code>{`
// Generate a service to connect to a REST API
const apiService = await ai.generate({
  prompt: 'Create a service to fetch and manage products from a REST API',
  apiSpec: './swagger.json', // Optional: provide API specification
  caching: true // Enable result caching
});
                `}</code>
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamplesTab;
