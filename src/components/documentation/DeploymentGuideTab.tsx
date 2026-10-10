
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Server, Cloud, Database, Lock } from 'lucide-react';

const DeploymentGuideTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deployment Guides</CardTitle>
          <CardDescription>Comprehensive guides for deploying D3VONN.IO in various environments</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="kubernetes">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
              <TabsTrigger value="docker">Docker</TabsTrigger>
              <TabsTrigger value="cloud">Cloud Providers</TabsTrigger>
              <TabsTrigger value="onprem">On-Premises</TabsTrigger>
            </TabsList>
            
            <TabsContent value="kubernetes" className="space-y-4">
              <h3 className="text-xl font-semibold">Kubernetes Deployment</h3>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Prerequisites</h4>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Kubernetes cluster (v1.19+)</li>
                  <li>kubectl CLI tool configured to connect to your cluster</li>
                  <li>Helm (v3.0+) for using the D3VONN.IO Helm chart</li>
                  <li>Persistent storage provisioner for database persistence</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Deployment Steps</h4>
                <ol className="list-decimal pl-6 space-y-4">
                  <li>
                    <p className="font-medium">Add the D3VONN.IO Helm repository:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>helm repo add devonn https://charts.d3vonn.io
helm repo update</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Create a values.yaml file to customize your deployment:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>{`# values.yaml
image:
  tag: latest

resources:
  requests:
    cpu: 2000m
    memory: 4Gi
  limits:
    cpu: 4000m
    memory: 8Gi

persistence:
  enabled: true
  size: 20Gi

ingress:
  enabled: true
  hostname: devonn.example.com
  tls: true

auth:
  adminPassword: "changeme"
  apiKey: "your-secure-api-key"

redis:
  enabled: true

postgresql:
  enabled: true
  persistence:
    size: 10Gi`}</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Install the D3VONN.IO Helm chart:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>helm install devonn devonn/d3vonn-io -f values.yaml -n d3vonn-io --create-namespace</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Verify the deployment:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>kubectl get pods -n d3vonn-io</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Access the D3VONN.IO dashboard:</p>
                    <p className="mt-2">Once all pods are running, access the dashboard at https://devonn.example.com (or the hostname you configured)</p>
                  </li>
                </ol>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Advanced Configuration</h4>
                <p>For advanced configuration options such as:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Horizontal Pod Autoscaling</li>
                  <li>Integration with external databases</li>
                  <li>Custom SSL certificates</li>
                  <li>Authentication with OIDC</li>
                </ul>
                <p>Refer to the <a href="/documentation/kubernetes-advanced" className="text-primary hover:underline">Advanced Kubernetes Configuration</a> guide.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="docker" className="space-y-4">
              <h3 className="text-xl font-semibold">Docker Deployment</h3>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Prerequisites</h4>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Docker Engine (v19.03+)</li>
                  <li>Docker Compose (v1.27+)</li>
                  <li>At least 4GB RAM and 2 CPU cores</li>
                  <li>20GB+ free disk space</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Docker Compose Deployment</h4>
                <ol className="list-decimal pl-6 space-y-4">
                  <li>
                    <p className="font-medium">Create a new directory for your deployment:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>mkdir d3vonn-io && cd d3vonn-io</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Create a docker-compose.yml file:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>{`version: '3.8'

services:
  frontend:
    image: devonnai/frontend:latest
    ports:
      - "80:80"
      - "443:443"
    environment:
      - API_URL=http://api:8000
    depends_on:
      - api
    volumes:
      - ./certs:/etc/nginx/certs
    restart: unless-stopped

  api:
    image: devonnai/api:latest
    environment:
      - DATABASE_URL=postgresql://devonn:devonn@db:5432/devonn
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=change_this_to_a_secure_secret
      - API_KEY=your_secure_api_key
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:13
    environment:
      - POSTGRES_USER=devonn
      - POSTGRES_PASSWORD=devonn
      - POSTGRES_DB=devonn
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:6
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:`}</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Launch the services:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>docker-compose up -d</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Check the status:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                      <code>docker-compose ps</code>
                    </pre>
                  </li>
                  <li>
                    <p className="font-medium">Access the D3VONN.IO dashboard:</p>
                    <p className="mt-2">Access the dashboard at http://localhost (or the server IP)</p>
                  </li>
                </ol>
              </div>
              
              <Alert className="mt-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                  For production environments, ensure you change all default passwords and secrets in the docker-compose.yml file.
                  Consider using Docker secrets or environment files to manage sensitive information.
                </AlertDescription>
              </Alert>
            </TabsContent>
            
            <TabsContent value="cloud" className="space-y-4">
              <h3 className="text-xl font-semibold">Cloud Provider Deployments</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center">
                      <Cloud className="h-5 w-5 mr-2 text-blue-500" />
                      <CardTitle>AWS Deployment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>Deploy D3VONN.IO on Amazon Web Services:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>EKS for Kubernetes deployments</li>
                      <li>ECS for container-based deployments</li>
                      <li>RDS for managed PostgreSQL database</li>
                      <li>ElastiCache for Redis</li>
                    </ul>
                    <a href="/documentation/aws-deployment" className="text-primary hover:underline block mt-4">View AWS Deployment Guide →</a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <div className="flex items-center">
                      <Cloud className="h-5 w-5 mr-2 text-blue-500" />
                      <CardTitle>Azure Deployment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>Deploy D3VONN.IO on Microsoft Azure:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>AKS for Kubernetes deployments</li>
                      <li>App Service for container-based deployments</li>
                      <li>Azure Database for PostgreSQL</li>
                      <li>Azure Cache for Redis</li>
                    </ul>
                    <a href="/documentation/azure-deployment" className="text-primary hover:underline block mt-4">View Azure Deployment Guide →</a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <div className="flex items-center">
                      <Cloud className="h-5 w-5 mr-2 text-blue-500" />
                      <CardTitle>Google Cloud Deployment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>Deploy D3VONN.IO on Google Cloud Platform:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>GKE for Kubernetes deployments</li>
                      <li>Cloud Run for container-based deployments</li>
                      <li>Cloud SQL for PostgreSQL</li>
                      <li>Memorystore for Redis</li>
                    </ul>
                    <a href="/documentation/gcp-deployment" className="text-primary hover:underline block mt-4">View GCP Deployment Guide →</a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <div className="flex items-center">
                      <Cloud className="h-5 w-5 mr-2 text-blue-500" />
                      <CardTitle>Digital Ocean Deployment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>Deploy D3VONN.IO on Digital Ocean:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>DOKS for Kubernetes deployments</li>
                      <li>App Platform for container-based deployments</li>
                      <li>Managed PostgreSQL database</li>
                      <li>Managed Redis database</li>
                    </ul>
                    <a href="/documentation/digitalocean-deployment" className="text-primary hover:underline block mt-4">View DO Deployment Guide →</a>
                  </CardContent>
                </Card>
              </div>
              
              <h4 className="text-lg font-medium mt-8">Multi-Cloud Deployment</h4>
              <p>For guidance on deploying D3VONN.IO across multiple cloud providers for high availability and disaster recovery, refer to our <a href="/documentation/multi-cloud" className="text-primary hover:underline">Multi-Cloud Deployment Guide</a>.</p>
            </TabsContent>
            
            <TabsContent value="onprem" className="space-y-4">
              <h3 className="text-xl font-semibold">On-Premises Deployment</h3>
              
              <div className="space-y-4">
                <h4 className="text-lg font-medium">System Requirements</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-primary" />
                        <CardTitle className="text-base">Minimum</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>4 CPU cores</li>
                        <li>8 GB RAM</li>
                        <li>50 GB storage</li>
                        <li>Ubuntu 20.04 or RHEL 8</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-primary" />
                        <CardTitle className="text-base">Recommended</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>8 CPU cores</li>
                        <li>16 GB RAM</li>
                        <li>100 GB SSD storage</li>
                        <li>Ubuntu 22.04 or RHEL 8</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-primary" />
                        <CardTitle className="text-base">Production</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-4 space-y-1 text-sm">
                        <li>16+ CPU cores</li>
                        <li>32+ GB RAM</li>
                        <li>250+ GB SSD storage</li>
                        <li>High-availability setup</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="space-y-4 mt-6">
                <h4 className="text-lg font-medium">Installation Methods</h4>
                <Tabs defaultValue="script">
                  <TabsList>
                    <TabsTrigger value="script">Installation Script</TabsTrigger>
                    <TabsTrigger value="manual">Manual Installation</TabsTrigger>
                    <TabsTrigger value="air-gapped">Air-Gapped Installation</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="script" className="space-y-4 mt-4">
                    <p>The easiest way to install D3VONN.IO on-premises is using our installation script:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto">
                      <code>curl -sSL https://install.d3vonn.io | sudo bash</code>
                    </pre>
                    <p>The script will check system requirements, install dependencies, and set up D3VONN.IO with default configurations.</p>
                    <p>For custom installations, use the configuration options:</p>
                    <pre className="bg-secondary p-3 rounded-md overflow-x-auto">
                      <code>curl -sSL https://install.d3vonn.io | sudo bash -s -- --data-dir /opt/devonn-data --port 8080</code>
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="manual" className="space-y-4 mt-4">
                    <ol className="list-decimal pl-6 space-y-4">
                      <li>
                        <p className="font-medium">Install dependencies:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>sudo apt update && sudo apt install -y docker.io docker-compose git curl</code>
                        </pre>
                      </li>
                      <li>
                        <p className="font-medium">Clone the D3VONN.IO repository:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>git clone https://github.com/d3vonn-io/devonn-on-prem.git
cd devonn-on-prem</code>
                        </pre>
                      </li>
                      <li>
                        <p className="font-medium">Configure the environment:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>cp .env.example .env
nano .env  # Edit configuration as needed</code>
                        </pre>
                      </li>
                      <li>
                        <p className="font-medium">Start the services:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>./install.sh</code>
                        </pre>
                      </li>
                    </ol>
                  </TabsContent>
                  
                  <TabsContent value="air-gapped" className="space-y-4 mt-4">
                    <p>For air-gapped environments without internet access:</p>
                    <ol className="list-decimal pl-6 space-y-4">
                      <li>
                        <p className="font-medium">Download the offline installation package from a connected system:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>curl -sSL https://download.d3vonn.io/offline-installer/latest -o devonn-offline.tar.gz</code>
                        </pre>
                      </li>
                      <li>
                        <p className="font-medium">Transfer the package to the air-gapped system</p>
                      </li>
                      <li>
                        <p className="font-medium">Extract and install:</p>
                        <pre className="bg-secondary p-3 rounded-md overflow-x-auto mt-2">
                          <code>tar -xzf devonn-offline.tar.gz
cd devonn-offline
sudo ./install.sh</code>
                        </pre>
                      </li>
                    </ol>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="space-y-4 mt-6">
                <h4 className="text-lg font-medium">System Architecture</h4>
                <p>The on-premises deployment consists of the following components:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <div className="flex items-center">
                      <Database className="h-4 w-4 mr-2 text-blue-500" />
                      <span className="font-medium">PostgreSQL Database</span>
                    </div>
                    <p className="text-sm ml-6">Stores user data, agent configurations, and task history</p>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <Database className="h-4 w-4 mr-2 text-red-500" />
                      <span className="font-medium">Redis Cache</span>
                    </div>
                    <p className="text-sm ml-6">Used for session management, caching, and real-time messaging</p>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <Server className="h-4 w-4 mr-2 text-green-500" />
                      <span className="font-medium">API Server</span>
                    </div>
                    <p className="text-sm ml-6">Handles all backend operations and AI processing</p>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <Server className="h-4 w-4 mr-2 text-purple-500" />
                      <span className="font-medium">Frontend Server</span>
                    </div>
                    <p className="text-sm ml-6">Serves the web interface for users to interact with the system</p>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <Lock className="h-4 w-4 mr-2 text-yellow-500" />
                      <span className="font-medium">Authentication Service</span>
                    </div>
                    <p className="text-sm ml-6">Manages user authentication and authorization</p>
                  </li>
                </ul>
              </div>
              
              <Alert className="mt-6 border-amber-500">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle>Enterprise Support</AlertTitle>
                <AlertDescription>
                  For enterprise-grade on-premises deployments with high-availability, disaster recovery, and professional support, 
                  please contact our <a href="/contact" className="text-primary hover:underline">enterprise sales team</a>.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Extension Configuration Guide</CardTitle>
          <CardDescription>Complete documentation for configuring the D3VONN.IO Chrome Extension</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <h3 className="text-lg font-semibold">Installation Options</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Chrome Web Store</td>
                <td className="py-2">Install directly from the Chrome Web Store</td>
                <td className="py-2">Individual users</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Enterprise Deployment</td>
                <td className="py-2">Deploy using Chrome Enterprise policies</td>
                <td className="py-2">Corporate environments</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Developer Mode</td>
                <td className="py-2">Load unpacked extension for development</td>
                <td className="py-2">Developers</td>
              </tr>
            </tbody>
          </table>
          
          <h3 className="text-lg font-semibold mt-6">Configuration Options</h3>
          <p className="mb-4">The extension can be configured through the settings page or via managed policies for enterprise deployments.</p>
          
          <h4 className="text-md font-medium">Core Settings</h4>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="font-medium">API URL</span>
              <p className="text-sm">The URL of your D3VONN.IO API instance. For on-premises installations, set this to your server address.</p>
              <p className="text-xs text-muted-foreground">Default: https://api.d3vonn.io</p>
            </li>
            <li>
              <span className="font-medium">User ID</span>
              <p className="text-sm">Your unique D3VONN.IO user identifier. This is used for authentication and tracking your interactions.</p>
            </li>
            <li>
              <span className="font-medium">Notification Settings</span>
              <p className="text-sm">Configure which notifications you want to receive:</p>
              <ul className="list-disc pl-6">
                <li>Task Completion Notifications</li>
                <li>Error Notifications</li>
              </ul>
            </li>
          </ul>
          
          <h4 className="text-md font-medium mt-4">Enterprise Configuration</h4>
          <p className="mb-2">For enterprise deployments, you can configure the extension using Chrome Enterprise policies.</p>
          <pre className="bg-secondary p-3 rounded-md overflow-x-auto">
            <code>{`{
  "devonn_api_url": {
    "Value": "https://your-company-devonn-instance.com/api"
  },
  "devonn_enable_notifications": {
    "Value": true
  },
  "devonn_allowed_domains": {
    "Value": [
      "yourdomain.com",
      "partner-domain.com"
    ]
  }
}`}</code>
          </pre>
          
          <h3 className="text-lg font-semibold mt-6">Security Best Practices</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="font-medium">API Authentication</span>
              <p className="text-sm">Always use a secure API key specific to the extension. Do not share API keys between applications.</p>
            </li>
            <li>
              <span className="font-medium">HTTPS Required</span>
              <p className="text-sm">Ensure your API endpoint is served over HTTPS to prevent man-in-the-middle attacks.</p>
            </li>
            <li>
              <span className="font-medium">Minimal Permissions</span>
              <p className="text-sm">The extension only requires access to the specific domains it needs to function. Review permissions during installation.</p>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeploymentGuideTab;
