/**
 * D3VONN AI Marketplace — Plugin SDK
 *
 * SDK for building, testing, and packaging D3VONN plugins.
 * Provides lifecycle hooks, context injection, and sandboxed execution.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PluginLifecycleHook = "onInstall" | "onActivate" | "onDeactivate" | "onUninstall" | "onUpdate" | "onConfigChange";

export interface PluginContext {
  pluginId: string;
  tenantId: string;
  workspaceId: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
  storage: PluginStorage;
  events: PluginEventEmitter;
  api: PluginAPI;
}

export interface PluginLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface PluginEventEmitter {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
}

export interface PluginAPI {
  callAgent(agentId: string, task: string): Promise<unknown>;
  queryKnowledge(query: string): Promise<unknown[]>;
  getMetrics(metricName: string): Promise<number>;
  publishEvent(eventType: string, payload: unknown): void;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  hooks: Partial<Record<PluginLifecycleHook, (ctx: PluginContext) => Promise<void>>>;
  execute: (ctx: PluginContext, input: unknown) => Promise<unknown>;
  healthCheck?: (ctx: PluginContext) => Promise<boolean>;
}

export interface PluginExecutionResult {
  pluginId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface PluginSandbox {
  pluginId: string;
  memoryLimit: number; // MB
  cpuLimit: number; // percentage
  timeoutMs: number;
  allowedAPIs: string[];
  networkAccess: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Plugin Runtime
// ─────────────────────────────────────────────────────────────────

export class PluginRuntime {
  private plugins: Map<string, PluginDefinition> = new Map();
  private contexts: Map<string, PluginContext> = new Map();
  private sandboxes: Map<string, PluginSandbox> = new Map();
  private executionLog: PluginExecutionResult[] = [];

  registerPlugin(definition: PluginDefinition, sandbox?: Partial<PluginSandbox>): void {
    this.plugins.set(definition.id, definition);
    this.sandboxes.set(definition.id, {
      pluginId: definition.id,
      memoryLimit: sandbox?.memoryLimit ?? 256,
      cpuLimit: sandbox?.cpuLimit ?? 25,
      timeoutMs: sandbox?.timeoutMs ?? 30000,
      allowedAPIs: sandbox?.allowedAPIs ?? ["callAgent", "queryKnowledge", "getMetrics", "publishEvent"],
      networkAccess: sandbox?.networkAccess ?? false,
    });
  }

  unregisterPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.contexts.delete(pluginId);
    this.sandboxes.delete(pluginId);
  }

  async activate(pluginId: string, context: PluginContext): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    this.contexts.set(pluginId, context);

    if (plugin.hooks.onActivate) {
      try {
        await plugin.hooks.onActivate(context);
      } catch (err) {
        context.logger.error("Plugin activation failed", { error: String(err) });
        return false;
      }
    }

    return true;
  }

  async deactivate(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    const context = this.contexts.get(pluginId);
    if (!plugin || !context) return false;

    if (plugin.hooks.onDeactivate) {
      try {
        await plugin.hooks.onDeactivate(context);
      } catch (err) {
        context.logger.error("Plugin deactivation failed", { error: String(err) });
      }
    }

    this.contexts.delete(pluginId);
    return true;
  }

  async execute(pluginId: string, input: unknown): Promise<PluginExecutionResult> {
    const plugin = this.plugins.get(pluginId);
    const context = this.contexts.get(pluginId);
    const sandbox = this.sandboxes.get(pluginId);
    const startTime = Date.now();

    if (!plugin || !context) {
      const result: PluginExecutionResult = {
        pluginId,
        success: false,
        error: "Plugin not found or not activated",
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      this.executionLog.push(result);
      return result;
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), sandbox?.timeoutMs ?? 30000)
      );

      const executionPromise = plugin.execute(context, input);
      const output = await Promise.race([executionPromise, timeoutPromise]);

      const result: PluginExecutionResult = {
        pluginId,
        success: true,
        result: output,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.executionLog.push(result);
      return result;
    } catch (err) {
      const result: PluginExecutionResult = {
        pluginId,
        success: false,
        error: String(err),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.executionLog.push(result);
      return result;
    }
  }

  async healthCheck(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    const context = this.contexts.get(pluginId);
    if (!plugin || !context || !plugin.healthCheck) return false;

    try {
      return await plugin.healthCheck(context);
    } catch {
      return false;
    }
  }

  getExecutionLog(pluginId?: string, limit = 100): PluginExecutionResult[] {
    let log = [...this.executionLog];
    if (pluginId) log = log.filter((e) => e.pluginId === pluginId);
    return log.slice(-limit);
  }

  getStats(): { totalPlugins: number; activePlugins: number; totalExecutions: number; successRate: number; avgDuration: number } {
    const successful = this.executionLog.filter((e) => e.success).length;
    const totalDuration = this.executionLog.reduce((sum, e) => sum + e.duration, 0);
    return {
      totalPlugins: this.plugins.size,
      activePlugins: this.contexts.size,
      totalExecutions: this.executionLog.length,
      successRate: this.executionLog.length > 0 ? successful / this.executionLog.length : 0,
      avgDuration: this.executionLog.length > 0 ? totalDuration / this.executionLog.length : 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// SDK Helper — Plugin Builder
// ─────────────────────────────────────────────────────────────────

export class PluginBuilder {
  private definition: Partial<PluginDefinition> = {};

  setId(id: string): this {
    this.definition.id = id;
    return this;
  }

  setName(name: string): this {
    this.definition.name = name;
    return this;
  }

  setVersion(version: string): this {
    this.definition.version = version;
    return this;
  }

  onInstall(handler: (ctx: PluginContext) => Promise<void>): this {
    if (!this.definition.hooks) this.definition.hooks = {};
    this.definition.hooks.onInstall = handler;
    return this;
  }

  onActivate(handler: (ctx: PluginContext) => Promise<void>): this {
    if (!this.definition.hooks) this.definition.hooks = {};
    this.definition.hooks.onActivate = handler;
    return this;
  }

  onDeactivate(handler: (ctx: PluginContext) => Promise<void>): this {
    if (!this.definition.hooks) this.definition.hooks = {};
    this.definition.hooks.onDeactivate = handler;
    return this;
  }

  onUninstall(handler: (ctx: PluginContext) => Promise<void>): this {
    if (!this.definition.hooks) this.definition.hooks = {};
    this.definition.hooks.onUninstall = handler;
    return this;
  }

  setExecutor(handler: (ctx: PluginContext, input: unknown) => Promise<unknown>): this {
    this.definition.execute = handler;
    return this;
  }

  setHealthCheck(handler: (ctx: PluginContext) => Promise<boolean>): this {
    this.definition.healthCheck = handler;
    return this;
  }

  build(): PluginDefinition {
    if (!this.definition.id || !this.definition.name || !this.definition.version || !this.definition.execute) {
      throw new Error("Plugin must have id, name, version, and execute handler");
    }
    return {
      id: this.definition.id,
      name: this.definition.name,
      version: this.definition.version,
      hooks: this.definition.hooks ?? {},
      execute: this.definition.execute,
      healthCheck: this.definition.healthCheck,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────

export function createPluginRuntime(): PluginRuntime {
  return new PluginRuntime();
}

export function createPluginBuilder(): PluginBuilder {
  return new PluginBuilder();
}
