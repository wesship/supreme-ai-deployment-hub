
import { CloudProvider, CloudProviderConfig, CloudCommandResult } from '../cloud/types';
import { simulateCommandExecution } from '../cloud/simulator';
import {
  RecoveryPoint,
  RecoveryResource,
  RecoveryPlan,
  RecoveryExecution,
  TargetOverride
} from './types';
import { generateMockResources } from './utils/resourceGenerator';
import { buildRecoveryCommand } from './utils/commandBuilder';
import { sortResourcesByDependencies } from './utils/dependencySorter';

export class DisasterRecoveryService {
  private provider: CloudProvider;
  private config: CloudProviderConfig;
  private recoveryPoints: RecoveryPoint[] = [];
  private recoveryPlans: RecoveryPlan[] = [];
  private recoveryExecutions: RecoveryExecution[] = [];

  constructor(provider: CloudProvider, config: CloudProviderConfig) {
    this.provider = provider;
    this.config = config;
  }

  private generateRecoveryPointId(): string {
    return `rp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRecoveryPlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private updateExecutionStatus(executionId: string, status: RecoveryExecution['status']): void {
    const index = this.recoveryExecutions.findIndex(execution => execution.id === executionId);
    if (index !== -1) {
      this.recoveryExecutions[index] = {
        ...this.recoveryExecutions[index],
        status
      };
    }
  }

  private async executeRecoveryCommand(
    resource: RecoveryResource,
    command: string
  ): Promise<CloudCommandResult> {
    return simulateCommandExecution({
      provider: this.provider,
      command,
      environment: 'recovery'
    });
  }

  async createRecoveryPoint(
    environment: string,
    description: string,
    resourceTypes: string[] = ['all']
  ): Promise<RecoveryPoint> {
    const recoveryPointId = this.generateRecoveryPointId();
    console.log(`Creating recovery point ${recoveryPointId} for ${environment} environment...`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const resources = generateMockResources(resourceTypes);
    
    const recoveryPoint: RecoveryPoint = {
      id: recoveryPointId,
      timestamp: new Date().toISOString(),
      description,
      provider: this.provider,
      environment,
      resources,
      tags: {
        CreatedBy: 'DisasterRecoveryService',
        Environment: environment
      }
    };
    
    this.recoveryPoints.push(recoveryPoint);
    console.log(`Recovery point ${recoveryPointId} created with ${resources.length} resources`);
    
    return recoveryPoint;
  }

  getRecoveryPoints(environment?: string): RecoveryPoint[] {
    if (environment) {
      return this.recoveryPoints.filter(rp => rp.environment === environment);
    }
    return [...this.recoveryPoints];
  }

  getRecoveryPoint(id: string): RecoveryPoint | undefined {
    return this.recoveryPoints.find(rp => rp.id === id);
  }

  createRecoveryPlan(plan: Omit<RecoveryPlan, 'id'>): RecoveryPlan {
    const planId = this.generateRecoveryPlanId();
    const newPlan: RecoveryPlan = {
      ...plan,
      id: planId
    };
    
    this.recoveryPlans.push(newPlan);
    console.log(`Recovery plan ${planId} created: ${plan.name}`);
    
    return newPlan;
  }

  getRecoveryPlans(): RecoveryPlan[] {
    return [...this.recoveryPlans];
  }

  getRecoveryPlan(id: string): RecoveryPlan | undefined {
    return this.recoveryPlans.find(plan => plan.id === id);
  }

  async executeRecovery(
    planId: string,
    recoveryPointId: string,
    options: {
      dryRun?: boolean;
      priority?: string[];
      skipResources?: string[];
      targetOverride?: TargetOverride;
    } = {}
  ): Promise<RecoveryExecution> {
    const plan = this.getRecoveryPlan(planId);
    if (!plan) {
      throw new Error(`Recovery plan ${planId} not found`);
    }
    
    const recoveryPoint = this.getRecoveryPoint(recoveryPointId);
    if (!recoveryPoint) {
      throw new Error(`Recovery point ${recoveryPointId} not found`);
    }
    
    // Create execution record
    const executionId = this.generateExecutionId();
    const execution: RecoveryExecution = {
      id: executionId,
      planId,
      startTime: new Date().toISOString(),
      status: 'pending',
      recoveryPointId,
      resources: [],
      logs: [`Starting recovery execution ${executionId} for plan ${plan.name}`]
    };
    
    this.recoveryExecutions.push(execution);
    
    try {
      this.updateExecutionStatus(executionId, 'in-progress');
      
      // Get resources to recover
      let resources = [...recoveryPoint.resources];
      
      // Filter resources based on plan and options
      resources = resources.filter(resource => {
        if (options.skipResources?.includes(resource.resourceId)) {
          return false;
        }
        
        const matchesSelector = plan.resourceSelectors.some(selector => {
          if (selector === 'all') return true;
          if (selector === resource.resourceType) return true;
          if (selector === resource.resourceId) return true;
          if (selector.endsWith('*') && resource.resourceId.startsWith(selector.slice(0, -1))) return true;
          return false;
        });
        
        const isExcluded = plan.excludedResources?.some(excluded => {
          if (excluded === resource.resourceType) return true;
          if (excluded === resource.resourceId) return true;
          if (excluded.endsWith('*') && resource.resourceId.startsWith(excluded.slice(0, -1))) return true;
          return false;
        });
        
        return matchesSelector && !isExcluded;
      });
      
      // Sort resources
      if (options.priority?.length) {
        resources.sort((a, b) => {
          const aIndex = options.priority!.findIndex(p => a.resourceId.includes(p) || a.resourceType === p);
          const bIndex = options.priority!.findIndex(p => b.resourceId.includes(p) || b.resourceType === p);
          return (aIndex === -1 ? 1000 : aIndex) - (bIndex === -1 ? 1000 : bIndex);
        });
      } else {
        resources = sortResourcesByDependencies(resources);
      }
      
      execution.resources = resources.map(resource => ({
        resourceId: resource.resourceId,
        status: 'pending'
      }));
      
      let successCount = 0;
      let failedCount = 0;
      
      for (const resource of resources) {
        const resourceIndex = execution.resources.findIndex(r => r.resourceId === resource.resourceId);
        if (resourceIndex === -1) continue;
        
        execution.resources[resourceIndex].status = 'in-progress';
        execution.logs.push(`Processing resource ${resource.resourceId} (${resource.resourceType})`);
        
        try {
          const dependencies = resource.dependencies || [];
          const dependenciesSuccess = dependencies.every(depId => {
            const dep = execution.resources.find(r => r.resourceId === depId);
            return dep && dep.status === 'completed';
          });
          
          if (!dependenciesSuccess) {
            execution.resources[resourceIndex].status = 'skipped';
            execution.logs.push(`Skipping resource ${resource.resourceId}: dependencies not met`);
            continue;
          }
          
          const command = buildRecoveryCommand(resource, plan.target, options.targetOverride);
          
          if (options.dryRun) {
            execution.logs.push(`[DRY RUN] Would execute: ${command}`);
            execution.resources[resourceIndex].status = 'completed';
            execution.resources[resourceIndex].details = 'Dry run - no changes made';
            successCount++;
            continue;
          }
          
          const result = await this.executeRecoveryCommand(resource, command);
          
          if (result.success) {
            execution.resources[resourceIndex].status = 'completed';
            execution.logs.push(`Successfully recovered ${resource.resourceId}`);
            successCount++;
          } else {
            execution.resources[resourceIndex].status = 'failed';
            execution.resources[resourceIndex].details = result.error || 'Unknown error';
            execution.logs.push(`Failed to recover ${resource.resourceId}: ${result.error}`);
            failedCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          execution.resources[resourceIndex].status = 'failed';
          execution.resources[resourceIndex].details = errorMessage;
          execution.logs.push(`Error processing ${resource.resourceId}: ${errorMessage}`);
          failedCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const endTime = new Date();
      const startTime = new Date(execution.startTime);
      const totalDuration = endTime.getTime() - startTime.getTime();
      
      execution.endTime = endTime.toISOString();
      execution.metrics = {
        totalDuration,
        resourcesRecovered: successCount,
        resourcesFailed: failedCount,
        dataTransferred: Math.floor(Math.random() * 1024 * successCount)
      };
      
      if (failedCount === 0) {
        this.updateExecutionStatus(executionId, 'completed');
        execution.logs.push(`Recovery execution completed successfully. Recovered ${successCount} resources.`);
      } else {
        this.updateExecutionStatus(executionId, 'failed');
        execution.logs.push(
          `Recovery execution completed with errors. ` +
          `Recovered: ${successCount}, Failed: ${failedCount}`
        );
      }
      
      return this.getRecoveryExecution(executionId)!;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      execution.endTime = new Date().toISOString();
      execution.logs.push(`Recovery execution failed: ${errorMessage}`);
      this.updateExecutionStatus(executionId, 'failed');
      
      throw error;
    }
  }

  getRecoveryExecutions(): RecoveryExecution[] {
    return [...this.recoveryExecutions];
  }

  getRecoveryExecution(id: string): RecoveryExecution | undefined {
    return this.recoveryExecutions.find(execution => execution.id === id);
  }

  async testRecoveryPlan(
    planId: string,
    options: {
      sampleSize?: number;
      dryRun?: boolean;
    } = {}
  ): Promise<RecoveryExecution> {
    const plan = this.getRecoveryPlan(planId);
    if (!plan) {
      throw new Error(`Recovery plan ${planId} not found`);
    }
    
    const recoveryPoints = this.getRecoveryPoints(plan.source.environment)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (recoveryPoints.length === 0) {
      throw new Error(`No recovery points found for environment ${plan.source.environment}`);
    }
    
    const recoveryPoint = recoveryPoints[0];
    
    let testResources = [...recoveryPoint.resources];
    if (options.sampleSize && options.sampleSize < testResources.length) {
      testResources = testResources
        .sort(() => Math.random() - 0.5)
        .slice(0, options.sampleSize);
    }
    
    const testPoint: RecoveryPoint = {
      ...recoveryPoint,
      id: `test-${recoveryPoint.id}`,
      description: `Test recovery point based on ${recoveryPoint.id}`,
      resources: testResources
    };
    
    this.recoveryPoints.push(testPoint);
    
    const targetOverride: TargetOverride = {
      environment: `test-${plan.target.environment}`
    };
    
    return this.executeRecovery(planId, testPoint.id, {
      dryRun: options.dryRun ?? true,
      targetOverride
    });
  }
}

