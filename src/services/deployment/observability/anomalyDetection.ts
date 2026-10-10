import { businessMetrics } from './metrics';

// Types for anomaly detection
export interface AnomalyConfig {
  metricName: string;
  threshold: number;
  timeWindowMinutes: number;
  sensitivityLevel: 'low' | 'medium' | 'high';
  minimumSampleSize: number;
}

export interface AnomalyDetectionResult {
  detected: boolean;
  score: number;
  metricName: string;
  currentValue: number;
  baselineValue: number;
  deviationPercent: number;
  timestamp: string;
  details?: Record<string, any>;
}

export interface AnomalyAlert {
  id: string;
  anomaly: AnomalyDetectionResult;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
  notes?: string[];
}

// Default anomaly detection configurations
const defaultConfigurations: Record<string, AnomalyConfig> = {
  'deployment_duration': {
    metricName: 'devonn_deployment_duration_seconds',
    threshold: 2.5, // 2.5x over baseline
    timeWindowMinutes: 60,
    sensitivityLevel: 'medium',
    minimumSampleSize: 5
  },
  'error_rate': {
    metricName: 'devonn_deployment_success_rate',
    threshold: 0.25, // 25% below baseline
    timeWindowMinutes: 120,
    sensitivityLevel: 'high',
    minimumSampleSize: 5
  },
  'api_latency': {
    metricName: 'devonn_api_request_latency_ms',
    threshold: 2.0, // 2x over baseline
    timeWindowMinutes: 30,
    sensitivityLevel: 'medium', 
    minimumSampleSize: 10
  }
};

// Simulated historical data for demonstration purposes
const mockHistoricalData: Record<string, number[]> = {
  'devonn_deployment_duration_seconds': [45, 42, 48, 50, 43, 41, 49, 52, 47, 46],
  'devonn_deployment_success_rate': [0.98, 1.0, 0.97, 1.0, 0.99, 1.0, 0.98, 1.0, 0.99, 1.0],
  'devonn_api_request_latency_ms': [120, 115, 125, 118, 122, 116, 119, 121, 117, 123]
};

/**
 * Anomaly Detection Service for identifying unusual patterns in deployment metrics
 */
export class AnomalyDetectionService {
  private configurations: Record<string, AnomalyConfig>;
  private alerts: AnomalyAlert[] = [];
  private historicalData: Record<string, {
    timestamp: number;
    value: number;
  }[]> = {};

  constructor(configurations?: Record<string, AnomalyConfig>) {
    this.configurations = configurations || defaultConfigurations;
    this.initializeHistoricalData();
  }

  /**
   * Initialize with mock historical data
   */
  private initializeHistoricalData(): void {
    const now = Date.now();
    
    // Initialize with mock data
    Object.entries(mockHistoricalData).forEach(([metric, values]) => {
      this.historicalData[metric] = values.map((value, index) => ({
        timestamp: now - (index * 15 * 60 * 1000), // every 15 minutes in the past
        value
      }));
    });
  }

  /**
   * Add a new data point for a specific metric
   */
  addDataPoint(metricName: string, value: number): void {
    if (!this.historicalData[metricName]) {
      this.historicalData[metricName] = [];
    }
    
    this.historicalData[metricName].push({
      timestamp: Date.now(),
      value
    });
    
    // Keep a reasonable amount of historical data
    const maxDataPoints = 1000;
    if (this.historicalData[metricName].length > maxDataPoints) {
      this.historicalData[metricName] = this.historicalData[metricName].slice(-maxDataPoints);
    }
  }

  /**
   * Check for anomalies across all configured metrics
   */
  checkForAnomalies(): AnomalyDetectionResult[] {
    const results: AnomalyDetectionResult[] = [];
    
    Object.keys(this.configurations).forEach(key => {
      const config = this.configurations[key];
      const result = this.detectAnomaly(config);
      
      if (result) {
        results.push(result);
        
        // If anomaly detected, create an alert
        if (result.detected) {
          this.createAlert(result);
        }
      }
    });
    
    return results;
  }

  /**
   * Check a specific metric for anomalies
   */
  checkMetricForAnomaly(metricName: string): AnomalyDetectionResult | null {
    // Find configuration for this metric
    const configKey = Object.keys(this.configurations).find(
      key => this.configurations[key].metricName === metricName
    );
    
    if (!configKey) {
      console.warn(`No anomaly detection configuration found for metric: ${metricName}`);
      return null;
    }
    
    return this.detectAnomaly(this.configurations[configKey]);
  }

  /**
   * Get all active anomaly alerts
   */
  getActiveAlerts(): AnomalyAlert[] {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  /**
   * Get all alerts (active, acknowledged, or resolved)
   */
  getAllAlerts(): AnomalyAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, assignedTo?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.status !== 'active') return false;
    
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.assignedTo = assignedTo;
    
    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, notes?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.status === 'resolved') return false;
    
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    if (notes) {
      if (!alert.notes) alert.notes = [];
      alert.notes.push(notes);
    }
    
    return true;
  }

  /**
   * Add a note to an alert
   */
  addNoteToAlert(alertId: string, note: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    if (!alert.notes) alert.notes = [];
    alert.notes.push(note);
    
    return true;
  }

  /**
   * Core anomaly detection algorithm
   */
  private detectAnomaly(config: AnomalyConfig): AnomalyDetectionResult | null {
    const { metricName, threshold, timeWindowMinutes, sensitivityLevel, minimumSampleSize } = config;
    
    // Get current value for the metric
    let currentValue = 0;
    
    // First try to get from the business metrics service
    if (metricName === 'devonn_deployment_success_rate') {
      currentValue = businessMetrics.getSuccessRate();
    } else {
      // If not available in business metrics, try to get latest from historical data
      const dataPoints = this.getDataPoints(metricName, timeWindowMinutes);
      
      // Not enough data points for detection
      if (dataPoints.length === 0) return null;
      
      currentValue = dataPoints[dataPoints.length - 1].value;
    }
    
    // Get baseline (average of historical values in the time window)
    const { baseline, deviation } = this.calculateBaseline(metricName, timeWindowMinutes);
    
    // Not enough data for baseline
    if (baseline === null) return null;
    
    // Calculate anomaly score
    let anomalyScore = 0;
    let deviationPercent = 0;
    
    if (metricName === 'devonn_deployment_success_rate') {
      // For success rate, lower is anomalous
      deviationPercent = ((baseline - currentValue) / baseline) * 100;
      anomalyScore = currentValue < baseline ? (baseline - currentValue) / baseline : 0;
    } else {
      // For durations and latencies, higher is anomalous
      deviationPercent = ((currentValue - baseline) / baseline) * 100;
      anomalyScore = currentValue > baseline ? (currentValue - baseline) / baseline : 0;
    }
    
    // Apply sensitivity factor
    const sensitivityFactor = this.getSensitivityFactor(sensitivityLevel);
    const adjustedThreshold = threshold * sensitivityFactor;
    
    // Determine if this is an anomaly
    const isAnomaly = anomalyScore > adjustedThreshold;
    
    return {
      detected: isAnomaly,
      score: anomalyScore,
      metricName,
      currentValue,
      baselineValue: baseline,
      deviationPercent,
      timestamp: new Date().toISOString(),
      details: {
        threshold: adjustedThreshold,
        sensitivityLevel,
        deviation,
        timeWindowMinutes
      }
    };
  }

  /**
   * Calculate baseline value for a metric within a time window
   */
  private calculateBaseline(metricName: string, timeWindowMinutes: number): { baseline: number | null; deviation: number } {
    const dataPoints = this.getDataPoints(metricName, timeWindowMinutes);
    
    if (dataPoints.length < 3) {
      return { baseline: null, deviation: 0 };
    }
    
    // Calculate average
    const values = dataPoints.map(point => point.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    
    // Calculate standard deviation
    const squaredDifferences = values.map(value => Math.pow(value - average, 2));
    const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDeviation = Math.sqrt(variance);
    
    return {
      baseline: average,
      deviation: stdDeviation
    };
  }

  /**
   * Get data points for a metric within a time window
   */
  private getDataPoints(metricName: string, timeWindowMinutes: number): { timestamp: number; value: number }[] {
    if (!this.historicalData[metricName]) {
      return [];
    }
    
    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    return this.historicalData[metricName].filter(point => point.timestamp >= cutoffTime);
  }

  /**
   * Create an alert for an anomaly
   */
  private createAlert(anomaly: AnomalyDetectionResult): void {
    // Check if there's already an active alert for this metric
    const existingAlert = this.alerts.find(
      alert => alert.anomaly.metricName === anomaly.metricName && alert.status === 'active'
    );
    
    if (existingAlert) {
      // Update the existing alert with the new anomaly data
      existingAlert.anomaly = anomaly;
      return;
    }
    
    // Create a new alert
    const newAlert: AnomalyAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      anomaly,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    this.alerts.push(newAlert);
  }

  /**
   * Get sensitivity factor based on sensitivity level
   */
  private getSensitivityFactor(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 1.5;
      case 'medium': return 1.0;
      case 'high': return 0.7;
    }
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetectionService();

// Export factory function for creating new instances
export function createAnomalyDetector(configs?: Record<string, AnomalyConfig>): AnomalyDetectionService {
  return new AnomalyDetectionService(configs);
}
