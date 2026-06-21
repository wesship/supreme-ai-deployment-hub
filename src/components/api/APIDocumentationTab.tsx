
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const APIDocumentationTab: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DEVONN.AI API Reference</CardTitle>
        <CardDescription>Complete documentation for the DEVONN.AI API</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Authentication</h3>
          <p>All API requests require authentication using an API key. Include your API key in the request headers:</p>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>{"Authorization: Bearer YOUR_API_KEY"}</code>
          </pre>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Base URL</h3>
          <p>All API endpoints are relative to the following base URL:</p>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>{"https://api.d3vonn.io/v1"}</code>
          </pre>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Core Endpoints</h3>
          
          <div className="border-b pb-4">
            <h4 className="font-medium">Generate Code</h4>
            <p className="text-sm text-muted-foreground mb-2">POST /generate</p>
            <p className="text-sm mb-2">Generates code based on a natural language prompt.</p>
            <div className="mt-2">
              <h5 className="text-sm font-medium">Request Body:</h5>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-xs">
                <code>{`
{
  "prompt": "Create a React component for a user profile",
  "framework": "react",
  "language": "typescript",
  "includeTests": true,
  "styleFormat": "tailwind"
}
                `}</code>
              </pre>
            </div>
          </div>
          
          <div className="border-b pb-4">
            <h4 className="font-medium">Enhance Code</h4>
            <p className="text-sm text-muted-foreground mb-2">POST /enhance</p>
            <p className="text-sm mb-2">Improves existing code based on specific instructions.</p>
            <div className="mt-2">
              <h5 className="text-sm font-medium">Request Body:</h5>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-xs">
                <code>{`
{
  "code": "// Your existing code here",
  "instruction": "Add form validation",
  "options": {
    "strictTyping": true
  }
}
                `}</code>
              </pre>
            </div>
          </div>
          
          <div className="border-b pb-4">
            <h4 className="font-medium">Explain Code</h4>
            <p className="text-sm text-muted-foreground mb-2">POST /explain</p>
            <p className="text-sm mb-2">Analyzes and explains code functionality.</p>
            <div className="mt-2">
              <h5 className="text-sm font-medium">Request Body:</h5>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-xs">
                <code>{`
{
  "code": "// Code to explain",
  "detailLevel": "intermediate",
  "format": "markdown"
}
                `}</code>
              </pre>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium">Debug Code</h4>
            <p className="text-sm text-muted-foreground mb-2">POST /debug</p>
            <p className="text-sm mb-2">Identifies and fixes issues in code.</p>
            <div className="mt-2">
              <h5 className="text-sm font-medium">Request Body:</h5>
              <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-xs">
                <code>{`
{
  "code": "// Code with issues",
  "error": "TypeError: Cannot read property 'map' of undefined",
  "suggestions": true
}
                `}</code>
              </pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default APIDocumentationTab;
