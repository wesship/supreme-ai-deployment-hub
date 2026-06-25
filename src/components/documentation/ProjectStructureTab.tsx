
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ProjectStructureTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Structure Overview</CardTitle>
          <CardDescription>Understanding the architecture and organization of D3VONN.IO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Key Features of the Project Structure</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <span className="font-medium">Modular Architecture:</span> Each component is self-contained with its own backend, frontend, and deployment configurations.
              </li>
              <li>
                <span className="font-medium">Consistent Structure:</span> Each component follows the same pattern:
                <ul className="list-circle pl-6 mt-1 space-y-1">
                  <li>Backend with models and API endpoints</li>
                  <li>Frontend with components and state management</li>
                  <li>Deployment configuration</li>
                </ul>
              </li>
              <li>
                <span className="font-medium">Shared Resources:</span> Common utilities and types are stored in the shared directory.
              </li>
            </ul>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">Technology Stack</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Backend</h4>
                <ul className="mt-2 space-y-1">
                  <li>FastAPI</li>
                  <li>MongoDB</li>
                  <li>WebSocket</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Frontend</h4>
                <ul className="mt-2 space-y-1">
                  <li>React</li>
                  <li>Redux</li>
                  <li>TypeScript</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Deployment</h4>
                <ul className="mt-2 space-y-1">
                  <li>Docker</li>
                  <li>Kubernetes</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">Development Workflow</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Each component can be developed and tested independently</li>
              <li>Docker Compose files for local development</li>
              <li>Shared resources for cross-component functionality</li>
            </ul>
            <p className="mt-2 text-muted-foreground">This structure provides a solid foundation for building a scalable and maintainable AI system while keeping components modular and independent.</p>
          </div>

          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-semibold">Directory Structure</h3>
            <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-xs">
              <code>{`
d3vonn-io/
├── components/
│   ├── code-generation/
│   │   ├── backend/
│   │   ├── frontend/
│   │   └── deployment/
│   ├── code-explanation/
│   │   ├── backend/
│   │   ├── frontend/
│   │   └── deployment/
│   ├── debugger/
│   │   ├── backend/
│   │   ├── frontend/
│   │   └── deployment/
│   └── enhancement/
│       ├── backend/
│       ├── frontend/
│       └── deployment/
├── shared/
│   ├── utils/
│   ├── types/
│   └── models/
├── infrastructure/
│   ├── kubernetes/
│   ├── monitoring/
│   └── ci-cd/
└── docs/
    ├── api/
    ├── guides/
    └── examples/
              `}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectStructureTab;
