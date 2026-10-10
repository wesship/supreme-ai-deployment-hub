
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Zap, Lock } from 'lucide-react';

const KongAPIGatewayPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Documentation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-full bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-2xl text-green-700 dark:text-green-400">Kong API Gateway</CardTitle>
            <CardDescription>
              Secure and efficient API management with rate limiting and authentication plugins
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
            Kong is a cloud-native, platform-agnostic API gateway. It sits in front of your services
            to manage, secure, and route requests to your APIs, while providing powerful plugin capabilities
            for authentication, rate limiting, and more.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-100 dark:border-green-900">
              <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
              <h3 className="font-medium mb-1">Security</h3>
              <p className="text-sm text-muted-foreground">
                Multiple authentication methods including OAuth2, JWT, Key Authentication, and more.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-100 dark:border-green-900">
              <Zap className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
              <h3 className="font-medium mb-1">Performance</h3>
              <p className="text-sm text-muted-foreground">
                High-performance, minimal latency API gateway with caching capabilities.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-100 dark:border-green-900">
              <Lock className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
              <h3 className="font-medium mb-1">Rate Limiting</h3>
              <p className="text-sm text-muted-foreground">
                Protect your services from overuse with configurable rate limiting and quotas.
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
              helm repo add kong https://charts.konghq.com<br/>
              helm repo update<br/>
              helm install kong/kong --generate-name --set ingressController.enabled=true
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Configuration</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              kubectl apply -f kong/ingress.yaml<br/>
              kubectl apply -f kong/rate-limiting.yaml<br/>
              kubectl apply -f kong/authentication-plugin.yaml
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Key Configuration Files</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              # ingress.yaml<br/>
              apiVersion: networking.k8s.io/v1<br/>
              kind: Ingress<br/>
              metadata:<br/>
              &nbsp; name: supreme-ai-ingress<br/>
              &nbsp; annotations:<br/>
              &nbsp; &nbsp; konghq.com/strip-path: "true"<br/>
              spec:<br/>
              &nbsp; ingressClassName: kong<br/>
              &nbsp; rules:<br/>
              &nbsp; - host: api.supreme-ai.com<br/>
              &nbsp; &nbsp; http:<br/>
              &nbsp; &nbsp; &nbsp; paths:<br/>
              &nbsp; &nbsp; &nbsp; - path: /<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; pathType: Prefix<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; backend:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; service:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; name: supreme-ai-backend<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; port:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; number: 8080
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kong Plugins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Authentication</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Kong offers multiple authentication plugins to secure your APIs.
              </p>
              <div className="bg-gray-950 text-gray-200 p-3 rounded-md font-mono text-xs overflow-x-auto">
                <pre>
                  # authentication-plugin.yaml<br/>
                  apiVersion: configuration.konghq.com/v1<br/>
                  kind: KongPlugin<br/>
                  metadata:<br/>
                  &nbsp; name: jwt-auth<br/>
                  plugin: jwt<br/>
                  config:<br/>
                  &nbsp; key_claim_name: kid<br/>
                  &nbsp; claims_to_verify: exp
                </pre>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Rate Limiting</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Protect your backend services from overuse with rate limiting.
              </p>
              <div className="bg-gray-950 text-gray-200 p-3 rounded-md font-mono text-xs overflow-x-auto">
                <pre>
                  # rate-limiting.yaml<br/>
                  apiVersion: configuration.konghq.com/v1<br/>
                  kind: KongPlugin<br/>
                  metadata:<br/>
                  &nbsp; name: rate-limiting<br/>
                  plugin: rate-limiting<br/>
                  config:<br/>
                  &nbsp; minute: 60<br/>
                  &nbsp; hour: 1000<br/>
                  &nbsp; policy: local
                </pre>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Request Transformation</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Transform requests before they reach your backend services.
              </p>
              <div className="bg-gray-950 text-gray-200 p-3 rounded-md font-mono text-xs overflow-x-auto">
                <pre>
                  # request-transformer.yaml<br/>
                  apiVersion: configuration.konghq.com/v1<br/>
                  kind: KongPlugin<br/>
                  metadata:<br/>
                  &nbsp; name: request-transformer<br/>
                  plugin: request-transformer<br/>
                  config:<br/>
                  &nbsp; add:<br/>
                  &nbsp; &nbsp; headers:<br/>
                  &nbsp; &nbsp; - X-Consumer-ID:$(consumer.id)<br/>
                  &nbsp; &nbsp; - X-Api-Version:v1
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KongAPIGatewayPage;
