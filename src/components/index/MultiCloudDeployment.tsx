
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Cloud, CloudCog, Server, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

// Define cloud provider types
type CloudProvider = 'aws' | 'gcp' | 'azure';
type DeploymentStatus = 'active' | 'inactive' | 'error' | 'pending';

interface CloudDeployment {
  provider: CloudProvider;
  region: string;
  status: DeploymentStatus;
  latency: number;
  lastUpdated: string;
  cost: string;
}

const cloudDeployments: CloudDeployment[] = [
  { 
    provider: 'aws', 
    region: 'us-east-1', 
    status: 'active', 
    latency: 42, 
    lastUpdated: '2 mins ago',
    cost: '$0.12/hr'
  },
  { 
    provider: 'gcp', 
    region: 'us-central1', 
    status: 'active', 
    latency: 38, 
    lastUpdated: '3 mins ago',
    cost: '$0.10/hr'
  },
  { 
    provider: 'azure', 
    region: 'eastus2', 
    status: 'pending', 
    latency: 55, 
    lastUpdated: '1 min ago',
    cost: '$0.14/hr'
  }
];

const MultiCloudDeployment: React.FC = () => {
  const [activeProvider, setActiveProvider] = useState<CloudProvider>('gcp');
  const [deployments, setDeployments] = useState(cloudDeployments);
  
  // Simulate cloud provider switching based on performance
  useEffect(() => {
    const interval = setInterval(() => {
      // Find the provider with lowest latency
      const bestProvider = [...deployments]
        .filter(d => d.status === 'active')
        .sort((a, b) => a.latency - b.latency)[0]?.provider;
      
      if (bestProvider && bestProvider !== activeProvider) {
        setActiveProvider(bestProvider);
      }
      
      // Simulate latency changes
      setDeployments(prev => 
        prev.map(deployment => ({
          ...deployment,
          latency: deployment.status === 'active' 
            ? Math.max(30, Math.floor(deployment.latency + (Math.random() * 20 - 10)))
            : deployment.latency
        }))
      );
    }, 5000);
    
    return () => clearInterval(interval);
  }, [deployments, activeProvider]);
  
  const getProviderIcon = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws':
        return <CloudCog className="h-8 w-8" />;
      case 'gcp':
        return <Cloud className="h-8 w-8" />;
      case 'azure':
        return <Server className="h-8 w-8" />;
    }
  };
  
  const getStatusIcon = (status: DeploymentStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };
  
  const getProviderColor = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'gcp':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'azure':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
    }
  };
  
  return (
    <section className="py-16 bg-gradient-to-br from-background to-background/95">
      <Container>
        <SectionHeading 
          centered
          animate 
          tag="Multi-Cloud Deployment"
          subheading="Deploy your AI models across multiple cloud providers for optimal performance and reliability"
        >
          Auto-Switching Cloud Deployment
        </SectionHeading>
        
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Deployment Panel */}
            <div className="lg:col-span-3">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-card border shadow-md rounded-xl p-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium">Active Deployment</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Currently routing traffic to the best performing provider
                    </p>
                  </div>
                  <div className={`mt-3 sm:mt-0 flex items-center gap-2 px-4 py-2 rounded-full ${getProviderColor(activeProvider)}`}>
                    {getProviderIcon(activeProvider)}
                    <span className="font-medium capitalize">{activeProvider}</span>
                  </div>
                </div>
                
                <div className="overflow-hidden bg-muted/30 rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-4 py-3">Provider</th>
                          <th className="text-left px-4 py-3">Region</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Latency</th>
                          <th className="text-left px-4 py-3">Last Updated</th>
                          <th className="text-left px-4 py-3">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deployments.map((deployment, index) => (
                          <tr 
                            key={deployment.provider} 
                            className={`${
                              activeProvider === deployment.provider ? 'bg-primary/5 border-l-2 border-primary' : ''
                            } ${index !== deployments.length - 1 ? 'border-b' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-full ${getProviderColor(deployment.provider)}`}>
                                  {getProviderIcon(deployment.provider)}
                                </div>
                                <span className="capitalize">{deployment.provider}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{deployment.region}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {getStatusIcon(deployment.status)}
                                <span className="capitalize">{deployment.status}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className={deployment.latency < 50 ? 'text-green-500' : 
                                  deployment.latency < 100 ? 'text-yellow-500' : 'text-red-500'}>
                                  {deployment.latency}ms
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{deployment.lastUpdated}</td>
                            <td className="px-4 py-3">{deployment.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">Auto-Switching Algorithm</h4>
                  <div className="text-xs text-muted-foreground">
                    <p>D3VONN.IO automatically routes traffic to the provider with the lowest latency and highest availability. If a provider fails, traffic is instantly routed to the next best option.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* Deployment Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-card border shadow-sm rounded-xl p-6"
            >
              <h3 className="text-sm font-medium text-muted-foreground">Uptime</h3>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-bold">99.99%</span>
                <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">+0.01%</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: '99.99%' }}></div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card border shadow-sm rounded-xl p-6"
            >
              <h3 className="text-sm font-medium text-muted-foreground">Response Time</h3>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-bold">42ms</span>
                <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">-8ms</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: '85%' }}></div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-card border shadow-sm rounded-xl p-6"
            >
              <h3 className="text-sm font-medium text-muted-foreground">Cost Optimization</h3>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-bold">42%</span>
                <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">+4%</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: '42%' }}></div>
              </div>
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default MultiCloudDeployment;
