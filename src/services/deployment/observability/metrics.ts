
import { CloudProvider } from '../cloud/types';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labelNames?: string[];
}

export interface MetricOptions {
  labels?: Record<string, string>;
  timestamp?: number;
}

// In-memory storage for metrics (in a real implementation, this would use a proper metrics system)
class MetricsRegistry {
  private metrics: Record<string, {
    definition: MetricDefinition;
    values: Record<string, number>;
    timestamps: Record<string, number>;
  }> = {};
  
  private defaultLabels: Record<string, string> = {
    service: 'devonn-deployment',
    environment: 'development'
  };
  
  /**
   * Set default labels for all metrics
   */
  setDefaultLabels(labels: Record<string, string>): void {
    this.defaultLabels = { ...this.defaultLabels, ...labels };
  }
  
  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    if (this.metrics[definition.name]) {
      console.warn(`Metric ${definition.name} already registered`);
      return;
    }
    
    this.metrics[definition.name] = {
      definition,
      values: {},
      timestamps: {}
    };
  }
  
  /**
   * Set a metric value
   */
  setMetric(name: string, value: number, options: MetricOptions = {}): void {
    const metric = this.metrics[name];
    if (!metric) {
      console.warn(`Metric ${name} not registered`);
      return;
    }
    
    const labels = { ...this.defaultLabels, ...options.labels };
    const labelKey = this.getLabelKey(labels);
    metric.values[labelKey] = value;
    metric.timestamps[labelKey] = options.timestamp || Date.now();
  }
  
  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, incrementBy = 1, options: MetricOptions = {}): void {
    const metric = this.metrics[name];
    if (!metric || metric.definition.type !== 'counter') {
      console.warn(`Metric ${name} not registered or not a counter`);
      return;
    }
    
    const labels = { ...this.defaultLabels, ...options.labels };
    const labelKey = this.getLabelKey(labels);
    metric.values[labelKey] = (metric.values[labelKey] || 0) + incrementBy;
    metric.timestamps[labelKey] = options.timestamp || Date.now();
  }
  
  /**
   * Observe a value for histograms and summaries
   */
  observe(name: string, value: number, options: MetricOptions = {}): void {
    const metric = this.metrics[name];
    if (!metric || (metric.definition.type !== 'histogram' && metric.definition.type !== 'summary')) {
      console.warn(`Metric ${name} not registered or not a histogram/summary`);
      return;
    }
    
    // In a real implementation, this would calculate quantiles or histogram buckets
    // For now, we'll just store the latest value
    const labels = { ...this.defaultLabels, ...options.labels };
    const labelKey = this.getLabelKey(labels);
    metric.values[labelKey] = value;
    metric.timestamps[labelKey] = options.timestamp || Date.now();
  }
  
  /**
   * Get all metrics in a format suitable for export
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      result[name] = {
        help: metric.definition.help,
        type: metric.definition.type,
        values: { ...metric.values },
        timestamps: { ...metric.timestamps }
      };
    }
    
    return result;
  }
  
  /**
   * Get a specific metric
   */
  getMetric(name: string): number | null {
    const metric = this.metrics[name];
    if (!metric) {
      return null;
    }
    
    const labelKey = this.getLabelKey(this.defaultLabels);
    return metric.values[labelKey] !== undefined ? metric.values[labelKey] : null;
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = {};
  }
  
  /**
   * Create a key from labels
   */
  private getLabelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }
}

// Create common metrics for deployment operations
export function createBusinessMetrics(environment: string): {
  registry: MetricsRegistry;
  recordDeploymentResult: (success: boolean, provider: CloudProvider, durationMs: number, options?: MetricOptions) => void;
  recordResourceCreation: (resourceType: string, count: number, options?: MetricOptions) => void;
  recordApiLatency: (apiName: string, durationMs: number, options?: MetricOptions) => void;
  getSuccessRate: () => number;
} {
  const registry = new MetricsRegistry();
  
  // Set environment in default labels
  registry.setDefaultLabels({
    environment
  });
  
  // Register common metrics
  registry.registerMetric({
    name: 'devonn_deployments_total',
    help: 'Total number of deployments',
    type: 'counter',
    labelNames: ['provider', 'status']
  });
  
  registry.registerMetric({
    name: 'devonn_deployment_duration_seconds',
    help: 'Duration of deployment operations in seconds',
    type: 'histogram',
    labelNames: ['provider', 'status']
  });
  
  registry.registerMetric({
    name: 'devonn_resources_created_total',
    help: 'Total number of resources created',
    type: 'counter',
    labelNames: ['resource_type']
  });
  
  registry.registerMetric({
    name: 'devonn_api_request_latency_ms',
    help: 'Latency of API requests in milliseconds',
    type: 'histogram',
    labelNames: ['api_name']
  });
  
  registry.registerMetric({
    name: 'devonn_deployment_success_rate',
    help: 'Success rate of deployments (0.0 to 1.0)',
    type: 'gauge'
  });
  
  // Track deployments for success rate calculation
  let deploymentsSuccessful = 0;
  let deploymentsTotal = 0;
  
  // Helper functions to record metrics
  function recordDeploymentResult(success: boolean, provider: CloudProvider, durationMs: number, options: MetricOptions = {}): void {
    const status = success ? 'success' : 'failure';
    
    // Increment deployment counter
    registry.incrementCounter('devonn_deployments_total', 1, {
      labels: { provider, status },
      ...options
    });
    
    // Record duration
    registry.observe('devonn_deployment_duration_seconds', durationMs / 1000, {
      labels: { provider, status },
      ...options
    });
    
    // Update success rate
    if (success) {
      deploymentsSuccessful++;
    }
    deploymentsTotal++;
    
    const successRate = deploymentsTotal > 0 ? deploymentsSuccessful / deploymentsTotal : 0;
    registry.setMetric('devonn_deployment_success_rate', successRate);
  }
  
  function recordResourceCreation(resourceType: string, count = 1, options: MetricOptions = {}): void {
    registry.incrementCounter('devonn_resources_created_total', count, {
      labels: { resource_type: resourceType },
      ...options
    });
  }
  
  function recordApiLatency(apiName: string, durationMs: number, options: MetricOptions = {}): void {
    registry.observe('devonn_api_request_latency_ms', durationMs, {
      labels: { api_name: apiName },
      ...options
    });
  }
  
  function getSuccessRate(): number {
    return deploymentsTotal > 0 ? deploymentsSuccessful / deploymentsTotal : 0;
  }
  
  return {
    registry,
    recordDeploymentResult,
    recordResourceCreation,
    recordApiLatency,
    getSuccessRate
  };
}

// Export a singleton instance
export const businessMetrics = createBusinessMetrics('development');
