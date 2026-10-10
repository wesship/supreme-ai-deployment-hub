
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, NetworkIcon, Lock } from 'lucide-react';

const IstioServiceMeshPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Documentation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-700 dark:text-blue-400">Istio Service Mesh</CardTitle>
            <CardDescription>
              Advanced traffic management with mTLS encryption and robust authorization policies
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Istio is an open-source service mesh that provides a uniform way to connect, manage, and secure microservices. 
            It extends Kubernetes to establish a programmable, application-aware network using the powerful Envoy proxy.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
              <h3 className="font-medium mb-1">Security</h3>
              <p className="text-sm text-muted-foreground">
                Automatic mTLS encryption for all service-to-service communication within the mesh.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
              <NetworkIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
              <h3 className="font-medium mb-1">Traffic Management</h3>
              <p className="text-sm text-muted-foreground">
                Advanced routing, load balancing, and traffic shaping for A/B testing and canary deployments.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
              <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
              <h3 className="font-medium mb-1">Policy Enforcement</h3>
              <p className="text-sm text-muted-foreground">
                Authorization policies for controlling access to your services with fine-grained control.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-medium mb-2">Installation</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              istioctl install --set profile=demo -y<br/>
              kubectl label namespace supreme-ai istio-injection=enabled
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Configuration</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              kubectl apply -f istio/virtual-service.yaml<br/>
              kubectl apply -f istio/destination-rule.yaml<br/>
              kubectl apply -f istio/authorization-policy.yaml
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Key Configuration Files</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              # virtual-service.yaml<br/>
              apiVersion: networking.istio.io/v1alpha3<br/>
              kind: VirtualService<br/>
              metadata:<br/>
              &nbsp; name: supreme-ai-virtual-service<br/>
              spec:<br/>
              &nbsp; hosts:<br/>
              &nbsp; - "*"<br/>
              &nbsp; gateways:<br/>
              &nbsp; - supreme-ai-gateway<br/>
              &nbsp; http:<br/>
              &nbsp; - match:<br/>
              &nbsp; &nbsp; - uri:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; prefix: /api<br/>
              &nbsp; &nbsp; route:<br/>
              &nbsp; &nbsp; - destination:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; host: supreme-ai-backend<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; port:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; number: 8080
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-3">
            <li>
              <span className="font-medium">Start Small:</span> Begin with essential features like traffic management and security, then expand as your team becomes familiar with Istio.
            </li>
            <li>
              <span className="font-medium">Incremental Adoption:</span> Gradually migrate your services to the mesh rather than attempting a complete switch all at once.
            </li>
            <li>
              <span className="font-medium">Monitor Resources:</span> Istio adds some overhead. Monitor your cluster performance to ensure adequate resources.
            </li>
            <li>
              <span className="font-medium">Use AuthZ Policies:</span> Implement fine-grained authorization policies to secure your services instead of relying on network-level security alone.
            </li>
            <li>
              <span className="font-medium">Testing:</span> Thoroughly test the service mesh in a staging environment before deploying to production.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default IstioServiceMeshPage;
