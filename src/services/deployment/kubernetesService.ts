import { CloudProvider, ServiceStatus, CloudProviderCredentials } from '../../types/deployment';
import { classifyCloudError } from './cloud/errorHandling';

interface ClusterConnectionOptions {
  kubeConfig?: string;
  provider?: CloudProvider;
  attempt?: number;
}

interface ClusterInfo {
  nodes: number;
  pods: number;
  services: number;
  deployments: number;
  status: string;
  provider?: CloudProvider;
  region?: string;
  version?: string;
  uptime?: string;
}

interface ConnectionResult {
  connected: boolean;
  error?: string;
  clusterInfo: ClusterInfo;
  serviceStatuses: ServiceStatus[];
  providerCredentials?: CloudProviderCredentials;
}

const mockClusterInfo: ClusterInfo = {
  nodes: 3,
  pods: 12,
  services: 5,
  deployments: 4,
  status: 'Healthy',
  provider: 'aws',
  region: 'us-west-2',
  version: 'v1.25.9',
  uptime: '7d 12h'
};

const mockServiceStatuses: ServiceStatus[] = [
  {
    name: 'frontend', status: 'Running', pods: '3/3', cpu: '45%', memory: '128Mi',
    namespace: 'default', type: 'ClusterIP', endpoints: ['10.0.0.1:8080'], age: '5d'
  },
  {
    name: 'backend', status: 'Running', pods: '2/2', cpu: '35%', memory: '256Mi',
    namespace: 'default', type: 'ClusterIP', endpoints: ['10.0.0.2:8000'], age: '5d'
  },
  {
    name: 'database', status: 'Running', pods: '1/1', cpu: '25%', memory: '512Mi',
    namespace: 'default', type: 'ClusterIP', endpoints: ['10.0.0.3:5432'], age: '5d'
  },
  {
    name: 'redis', status: 'Running', pods: '1/1', cpu: '10%', memory: '64Mi',
    namespace: 'default', type: 'ClusterIP', endpoints: ['10.0.0.4:6379'], age: '5d'
  }
];

function extractKubernetesServer(kubeConfig: string): URL | null {
  const serverLine = kubeConfig.split(/\r?\n/).find((line) => line.trimStart().startsWith('server:'));
  if (!serverLine) return null;

  const rawServer = serverLine.slice(serverLine.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
  try {
    const parsed = new URL(rawServer);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function hostnameEndsWith(hostname: string, suffix: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === suffix || normalized.endsWith(`.${suffix}`);
}

function regionBeforeMarker(hostname: string, marker: string, fallback: string): string {
  const labels = hostname.toLowerCase().split('.');
  const markerIndex = labels.indexOf(marker);
  return markerIndex > 0 ? labels[markerIndex - 1] : fallback;
}

export const connectToKubernetesCluster = async (options: ClusterConnectionOptions): Promise<ConnectionResult> => {
  const { kubeConfig, provider = 'aws' } = options;

  try {
    console.log('Connecting to Kubernetes cluster:', { provider, kubeConfigProvided: !!kubeConfig });
    await new Promise(resolve => setTimeout(resolve, 800));

    let region = 'unknown';

    if (kubeConfig) {
      try {
        const serverUrl = extractKubernetesServer(kubeConfig);
        if (serverUrl) {
          const hostname = serverUrl.hostname.toLowerCase();
          if (hostnameEndsWith(hostname, 'eks.amazonaws.com')) {
            region = regionBeforeMarker(hostname, 'eks', 'us-west-2');
          } else if (hostnameEndsWith(hostname, 'azmk8s.io')) {
            region = regionBeforeMarker(hostname, 'azmk8s', 'westus2');
          } else if (hostnameEndsWith(hostname, 'gke.io') || hostnameEndsWith(hostname, 'googleapis.com')) {
            region = 'us-central1';
          }
        }
      } catch (error) {
        console.error('Failed to parse kubeconfig:', error);
        return {
          connected: false,
          error: 'Invalid kubeconfig format. Please check your YAML syntax.',
          clusterInfo: { nodes: 0, pods: 0, services: 0, deployments: 0, status: 'Disconnected' },
          serviceStatuses: []
        };
      }
    }

    const expirationDate = new Date(Date.now() + 3600000);
    const enhancedClusterInfo = { ...mockClusterInfo, provider, region };

    return {
      connected: true,
      clusterInfo: enhancedClusterInfo,
      serviceStatuses: mockServiceStatuses,
      providerCredentials: {
        provider,
        authenticated: true,
        profileName: provider === 'aws' ? 'default' : undefined,
        region,
        expiresAt: expirationDate
      }
    };
  } catch (error) {
    console.error('Error connecting to Kubernetes cluster:', error);
    const { errorMessage } = classifyCloudError(error, provider);

    return {
      connected: false,
      error: errorMessage || (error instanceof Error ? error.message : 'Unknown error occurred'),
      clusterInfo: { nodes: 0, pods: 0, services: 0, deployments: 0, status: 'Disconnected' },
      serviceStatuses: []
    };
  }
};

export const getClusterDetails = async (kubeConfig?: string) => {
  const connection = await connectToKubernetesCluster({ kubeConfig });
  return connection.clusterInfo;
};

export const getServiceStatuses = async (kubeConfig?: string, namespace?: string) => {
  const connection = await connectToKubernetesCluster({ kubeConfig });
  if (namespace) {
    return connection.serviceStatuses.filter(service => service.namespace === namespace);
  }
  return connection.serviceStatuses;
};

export const deployToCluster = async (kubeConfig?: string, manifests?: string[]) => {
  if (!kubeConfig || !manifests || manifests.length === 0) {
    return { success: false, message: 'Missing kubeconfig or manifests' };
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const results = manifests.map((manifestStr, index) => {
      try {
        const manifest = JSON.parse(manifestStr);
        return {
          success: true,
          resource: `${manifest.kind}/${manifest.metadata?.name || `resource-${index}`}`,
          details: { status: 'Created' }
        };
      } catch (error) {
        return {
          success: false,
          resource: `Invalid-Manifest-${index}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return {
      success: results.every(r => r.success),
      results,
      message: results.every(r => r.success)
        ? 'All resources deployed successfully'
        : 'Some resources failed to deploy'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred during deployment'
    };
  }
};
