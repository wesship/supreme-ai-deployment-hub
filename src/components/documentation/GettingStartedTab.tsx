
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GettingStartedTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>Set up D3VONN.IO in your environment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-lg font-semibold">Requirements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Node.js 16.0 or higher</li>
            <li>npm 7.0 or higher (or yarn/pnpm)</li>
            <li>Python 3.8 or higher (for certain features)</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4">Quick Install</h3>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>npm install d3vonn-io</code>
          </pre>

          <h3 className="text-lg font-semibold mt-4">Basic Setup</h3>
          <p>After installation, initialize D3VONN.IO in your project:</p>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto">
            <code>{`
import { DevonnAI } from 'd3vonn-io';

// Initialize with your API key
const ai = new DevonnAI({
  apiKey: 'your-api-key',
  environment: 'production'
});

// Now you can use the AI in your application
const response = await ai.generate({ 
  prompt: 'Create a React component for a login form'
});
            `}</code>
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
          <CardDescription>Understand the core principles behind D3VONN.IO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Intelligent Code Generation</h3>
            <p>D3VONN.IO analyzes your project structure, coding style, and requirements to generate contextually appropriate code.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">Context Awareness</h3>
            <p>The AI maintains an understanding of your codebase, allowing it to make consistent and integrated suggestions.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">Framework Agnostic</h3>
            <p>D3VONN.IO works with most popular frameworks and libraries, including React, Vue, Angular, and many more.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GettingStartedTab;
