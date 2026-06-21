import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CodeDisplay from '@/components/CodeDisplay';
import { Link } from 'react-router-dom';

const DeploymentConfig = () => {
  // Sample configurations from the deployment guide
  const kubeClusterConfig = `gcloud container clusters create devonn-ai-cluster --num-nodes=3 --zone=us-central1-a`;
  
  const persistentStorageConfig = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi`;
  
  const dockerBuildConfig = `# Backend
docker build -t your-dockerhub-username/devonn-ai-backend ./backend
docker push your-dockerhub-username/devonn-ai-backend

# Frontend
docker build -t your-dockerhub-username/devonn-ai-frontend ./frontend
docker push your-dockerhub-username/devonn-ai-frontend`;
  
  const k8sDeploymentConfig = `kubectl apply -f infrastructure/kubernetes/devonn-ai-backend-deployment.yaml
kubectl apply -f infrastructure/kubernetes/devonn-ai-frontend-deployment.yaml
kubectl apply -f infrastructure/kubernetes/devonn-ai-inference-deployment.yaml
kubectl apply -f infrastructure/kubernetes/devonn-ai-recommendations-deployment.yaml
kubectl apply -f infrastructure/kubernetes/ingress.yaml`;
  
  const prometheusConfig = `apiVersion: v1
kind: Service
metadata:
  name: prometheus
spec:
  selector:
    app: prometheus
  ports:
    - protocol: TCP
      port: 9090
      targetPort: 9090
  type: NodePort`;
  
  const envVarsConfig = `# Required environment variables
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cluster">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="cluster">Cluster</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="domain">Domain</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cluster">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">1. Kubernetes Cluster Creation</h3>
                <CodeDisplay code={kubeClusterConfig} language="bash" />
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">2. Persistent Storage</h3>
                <CodeDisplay code={persistentStorageConfig} language="yaml" />
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">3. Environment Variables</h3>
                <CodeDisplay code={envVarsConfig} language="bash" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="services">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">1. Docker Build & Push</h3>
                <CodeDisplay code={dockerBuildConfig} language="bash" />
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">2. Kubernetes Deployment</h3>
                <CodeDisplay code={k8sDeploymentConfig} language="bash" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="monitoring">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">1. Prometheus Configuration</h3>
                <CodeDisplay code={prometheusConfig} language="yaml" />
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">2. Verification Steps</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Access Prometheus dashboard at: <code>http://&lt;node-ip&gt;:9090</code></li>
                  <li>Access Grafana dashboard at: <code>http://&lt;node-ip&gt;:3000</code></li>
                  <li>Default Grafana credentials: admin/admin</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="domain">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Domain Configuration</h3>
                <p className="text-sm mb-3">
                  Configure the d3vonn.io domain to point to your Kubernetes deployment.
                </p>
                
                <CodeDisplay 
                  code={`# Route53 DNS Configuration
aws route53domains update-domain-nameservers \\
  --domain-name d3vonn.io \\
  --nameservers \\
    Name=ns-xxxx.awsdns-xx.com \\
    Name=ns-xxxx.awsdns-xx.net \\
    Name=ns-xxxx.awsdns-xx.org \\
    Name=ns-xxxx.awsdns-xx.co.uk`} 
                  language="bash" 
                />
              </div>
              
              <div className="bg-secondary/30 p-4 rounded-md mt-4">
                <p className="text-sm">
                  For complete domain setup instructions, visit the{" "}
                  <Link to="/documentation" className="text-primary underline">
                    Documentation
                  </Link>{" "}
                  page and navigate to the Domain Setup tab.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DeploymentConfig;
