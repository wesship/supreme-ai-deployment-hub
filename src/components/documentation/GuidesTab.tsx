
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GuidesTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Building Your First AI-Enhanced App</CardTitle>
          <CardDescription>Step-by-step guide to creating an application with D3VONN.IO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">1. Project Setup</h3>
            <p>Create a new project and install the D3VONN.IO package as described in the installation guide.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">2. Configure AI Settings</h3>
            <p>Set up your AI configuration with your API key and preferred settings.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">3. Define Your Requirements</h3>
            <p>Clearly describe what you want to build in natural language or using our special syntax.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">4. Generate Initial Code</h3>
            <p>Use the D3VONN.IO to generate the foundation of your application.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">5. Refine and Iterate</h3>
            <p>Review the generated code, provide feedback, and let the AI make adjustments based on your input.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Techniques</CardTitle>
          <CardDescription>Maximize your productivity with these best practices</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            <li className="border-b pb-3">
              <h3 className="font-semibold">Custom Templates</h3>
              <p className="text-sm text-muted-foreground">Define and use your own templates to maintain consistency across your projects.</p>
            </li>
            <li className="border-b pb-3">
              <h3 className="font-semibold">Integration with CI/CD</h3>
              <p className="text-sm text-muted-foreground">Automate code generation and reviews as part of your continuous integration pipeline.</p>
            </li>
            <li className="border-b pb-3">
              <h3 className="font-semibold">Custom Fine-tuning</h3>
              <p className="text-sm text-muted-foreground">Train the AI on your specific codebase to improve relevance and quality of suggestions.</p>
            </li>
            <li>
              <h3 className="font-semibold">Team Collaboration</h3>
              <p className="text-sm text-muted-foreground">Configure shared settings and standards for consistent AI-generated code across your team.</p>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuidesTab;
