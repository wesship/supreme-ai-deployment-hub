
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LineChart, Activity, Search } from 'lucide-react';

const ObservabilityStackPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back to Documentation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-full bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-700 dark:text-purple-400">Observability Stack</CardTitle>
            <CardDescription>
              Comprehensive monitoring with Prometheus, Grafana, and Jaeger for complete system visibility
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
            Observability is critical for modern microservices architectures. Our comprehensive stack 
            includes tools for metrics collection, visualization, and distributed tracing to provide 
            complete visibility into your system.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-100 dark:border-purple-900">
              <LineChart className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
              <h3 className="font-medium mb-1">Metrics</h3>
              <p className="text-sm text-muted-foreground">
                Collect and store time-series metrics with Prometheus to monitor system performance.
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-100 dark:border-purple-900">
              <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
              <h3 className="font-medium mb-1">Visualization</h3>
              <p className="text-sm text-muted-foreground">
                Create dashboards with Grafana to visualize metrics and set up alerts for monitoring.
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-100 dark:border-purple-900">
              <Search className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
              <h3 className="font-medium mb-1">Tracing</h3>
              <p className="text-sm text-muted-foreground">
                Use Jaeger for distributed tracing to debug and optimize request flows across services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prometheus & Grafana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-medium mb-2">Installation</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              helm repo add prometheus-community https://prometheus-community.github.io/helm-charts<br/>
              helm repo add grafana https://grafana.github.io/helm-charts<br/>
              helm repo update<br/>
              helm install prometheus prometheus-community/prometheus<br/>
              helm install grafana grafana/grafana
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Configuration</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              kubectl apply -f prometheus/alerting-rules.yaml<br/>
              <br/>
              # To access Grafana Dashboard<br/>
              kubectl get secret --namespace default grafana -o jsonpath="&#123;.data.admin-password&#125;" | base64 --decode ; echo<br/>
              kubectl port-forward svc/grafana 3000:80
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Key Metrics</h3>
          <ul className="list-disc list-inside space-y-2">
            <li>CPU and memory usage by pod and node</li>
            <li>Network traffic by service</li>
            <li>Request latency distribution</li>
            <li>Error rates and status codes</li>
            <li>Queue lengths and processing times</li>
            <li>Database connection pool usage</li>
            <li>Custom business metrics</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jaeger Distributed Tracing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-medium mb-2">Installation</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              kubectl create namespace observability<br/>
              kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.36.0/jaeger-operator.yaml -n observability<br/>
              kubectl apply -f jaeger/jaeger.yaml
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Jaeger Configuration</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              # jaeger.yaml<br/>
              apiVersion: jaegertracing.io/v1<br/>
              kind: Jaeger<br/>
              metadata:<br/>
              &nbsp; name: supreme-ai-jaeger<br/>
              spec:<br/>
              &nbsp; strategy: production<br/>
              &nbsp; storage:<br/>
              &nbsp; &nbsp; type: elasticsearch<br/>
              &nbsp; &nbsp; options:<br/>
              &nbsp; &nbsp; &nbsp; es:<br/>
              &nbsp; &nbsp; &nbsp; &nbsp; server-urls: http://elasticsearch:9200<br/>
              &nbsp; ingress:<br/>
              &nbsp; &nbsp; enabled: true<br/>
              &nbsp; &nbsp; hosts:<br/>
              &nbsp; &nbsp; - jaeger.supreme-ai.com
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>EFK/Loki Logging Stack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-medium mb-2">Installation</h3>
          <div className="bg-gray-950 text-gray-200 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>
              helm repo add elastic https://helm.elastic.co<br/>
              helm repo update<br/>
              helm install elasticsearch elastic/elasticsearch<br/>
              helm install kibana elastic/kibana<br/>
              helm install fluentd-elasticsearch elastic/fluentd-elasticsearch
            </pre>
          </div>
          
          <h3 className="font-medium mb-2 mt-6">Log Collection</h3>
          <p>
            Fluentd collects logs from all containers across your Kubernetes clusters and forwards them to Elasticsearch for storage and indexing.
            Kibana provides a powerful interface for searching, filtering, and analyzing logs.
          </p>
          
          <h3 className="font-medium mb-2 mt-6">Key Features</h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Centralized log storage and indexing</li>
            <li>Full-text search across all logs</li>
            <li>Visualizations and dashboards for log analysis</li>
            <li>Alerting based on log patterns</li>
            <li>Integration with Prometheus for correlation between logs and metrics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ObservabilityStackPage;
