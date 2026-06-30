/**
 * D3VONN Developer Platform — CLI & SDK
 *
 * Command-line interface and SDK definitions with
 * command registry, argument parsing, and output formatting.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CommandCategory = "agents" | "workflows" | "plugins" | "config" | "auth" | "deploy" | "logs" | "billing";
export type ArgType = "string" | "number" | "boolean" | "array";
export type OutputFormat = "json" | "table" | "yaml" | "text";

export interface CliCommand {
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  args: CliArg[];
  flags: CliFlag[];
  examples: CliExample[];
  handler: string; // handler function name
  requiresAuth: boolean;
  minPermission?: string;
}

export interface CliArg {
  name: string;
  type: ArgType;
  required: boolean;
  description: string;
  default?: unknown;
  choices?: string[];
}

export interface CliFlag {
  name: string;
  short?: string;
  type: ArgType;
  description: string;
  default?: unknown;
}

export interface CliExample {
  description: string;
  command: string;
  output?: string;
}

export interface CliContext {
  apiKey: string;
  baseUrl: string;
  tenantId: string;
  outputFormat: OutputFormat;
  verbose: boolean;
  profile: string;
}

export interface CliResult {
  success: boolean;
  data?: unknown;
  error?: string;
  format: OutputFormat;
}

export interface SdkMethod {
  name: string;
  module: string;
  description: string;
  params: SdkParam[];
  returnType: string;
  example: string;
  deprecated?: boolean;
}

export interface SdkParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// ─────────────────────────────────────────────────────────────────
// CLI Registry
// ─────────────────────────────────────────────────────────────────

export class CliRegistry {
  private commands: Map<string, CliCommand> = new Map();
  private sdkMethods: SdkMethod[] = [];

  // ─── Command Registration ───────────────────────────────────

  registerCommand(command: CliCommand): void {
    this.commands.set(`${command.category}:${command.name}`, command);
  }

  getCommand(category: CommandCategory, name: string): CliCommand | undefined {
    return this.commands.get(`${category}:${name}`);
  }

  listCommands(category?: CommandCategory): CliCommand[] {
    let commands = [...this.commands.values()];
    if (category) commands = commands.filter((c) => c.category === category);
    return commands;
  }

  // ─── Command Execution ──────────────────────────────────────

  async execute(commandStr: string, context: CliContext): Promise<CliResult> {
    const parts = commandStr.trim().split(/\s+/);
    if (parts.length < 2) return { success: false, error: "Usage: d3vonn <category> <command> [args]", format: context.outputFormat };

    const [category, name] = parts;
    const command = this.getCommand(category as CommandCategory, name);
    if (!command) return { success: false, error: `Unknown command: ${category} ${name}`, format: context.outputFormat };

    if (command.requiresAuth && !context.apiKey) {
      return { success: false, error: "Authentication required. Run 'd3vonn auth login' first.", format: context.outputFormat };
    }

    // Parse args and flags
    const parsedArgs = this.parseArgs(parts.slice(2), command);

    return {
      success: true,
      data: { command: `${category} ${name}`, args: parsedArgs, handler: command.handler },
      format: context.outputFormat,
    };
  }

  private parseArgs(tokens: string[], command: CliCommand): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let argIndex = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("--")) {
        const flagName = token.slice(2);
        const flag = command.flags.find((f) => f.name === flagName);
        if (flag) {
          if (flag.type === "boolean") {
            result[flagName] = true;
          } else {
            result[flagName] = tokens[++i];
          }
        }
      } else if (token.startsWith("-")) {
        const short = token.slice(1);
        const flag = command.flags.find((f) => f.short === short);
        if (flag) {
          if (flag.type === "boolean") {
            result[flag.name] = true;
          } else {
            result[flag.name] = tokens[++i];
          }
        }
      } else {
        if (argIndex < command.args.length) {
          result[command.args[argIndex].name] = token;
          argIndex++;
        }
      }
    }

    return result;
  }

  // ─── SDK Methods ────────────────────────────────────────────

  registerSdkMethod(method: SdkMethod): void {
    this.sdkMethods.push(method);
  }

  listSdkMethods(module?: string): SdkMethod[] {
    if (module) return this.sdkMethods.filter((m) => m.module === module);
    return [...this.sdkMethods];
  }

  // ─── Help Generation ────────────────────────────────────────

  generateHelp(category?: CommandCategory): string {
    const commands = this.listCommands(category);
    let help = "D3VONN CLI — AI Orchestration Platform\n\n";

    if (category) {
      help += `Commands for '${category}':\n\n`;
    } else {
      help += "Available commands:\n\n";
    }

    const grouped: Record<string, CliCommand[]> = {};
    for (const cmd of commands) {
      if (!grouped[cmd.category]) grouped[cmd.category] = [];
      grouped[cmd.category].push(cmd);
    }

    for (const [cat, cmds] of Object.entries(grouped)) {
      help += `  ${cat}:\n`;
      for (const cmd of cmds) {
        help += `    ${cmd.name.padEnd(20)} ${cmd.description}\n`;
      }
      help += "\n";
    }

    return help;
  }

  generateSdkDocs(): string {
    let docs = "# D3VONN SDK Reference\n\n";
    const modules = [...new Set(this.sdkMethods.map((m) => m.module))];

    for (const mod of modules) {
      docs += `## ${mod}\n\n`;
      const methods = this.sdkMethods.filter((m) => m.module === mod);
      for (const method of methods) {
        docs += `### \`${method.name}(${method.params.map((p) => `${p.name}: ${p.type}`).join(", ")})\`\n`;
        docs += `${method.description}\n\n`;
        docs += `Returns: \`${method.returnType}\`\n\n`;
        if (method.example) docs += `\`\`\`typescript\n${method.example}\n\`\`\`\n\n`;
      }
    }

    return docs;
  }
}

// ─────────────────────────────────────────────────────────────────
// Pre-built Commands
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_COMMANDS: CliCommand[] = [
  {
    name: "list", category: "agents", description: "List all deployed agents", usage: "d3vonn agents list [--status <status>]",
    args: [], flags: [{ name: "status", short: "s", type: "string", description: "Filter by status" }, { name: "format", short: "f", type: "string", description: "Output format", default: "table" }],
    examples: [{ description: "List active agents", command: "d3vonn agents list --status active" }], handler: "listAgents", requiresAuth: true,
  },
  {
    name: "deploy", category: "agents", description: "Deploy an agent from the marketplace", usage: "d3vonn agents deploy <agent-id> [--config <path>]",
    args: [{ name: "agentId", type: "string", required: true, description: "Agent ID to deploy" }],
    flags: [{ name: "config", short: "c", type: "string", description: "Config file path" }],
    examples: [{ description: "Deploy Hermes agent", command: "d3vonn agents deploy hermes-v2 --config ./hermes.yaml" }], handler: "deployAgent", requiresAuth: true, minPermission: "admin",
  },
  {
    name: "run", category: "workflows", description: "Execute a workflow", usage: "d3vonn workflows run <workflow-id> [--input <json>]",
    args: [{ name: "workflowId", type: "string", required: true, description: "Workflow ID" }],
    flags: [{ name: "input", short: "i", type: "string", description: "Input JSON" }, { name: "async", type: "boolean", description: "Run asynchronously" }],
    examples: [{ description: "Run data pipeline", command: "d3vonn workflows run data-pipeline --input '{\"source\": \"s3\"}'" }], handler: "runWorkflow", requiresAuth: true,
  },
  {
    name: "login", category: "auth", description: "Authenticate with D3VONN", usage: "d3vonn auth login [--key <api-key>]",
    args: [], flags: [{ name: "key", short: "k", type: "string", description: "API key" }, { name: "browser", type: "boolean", description: "Open browser for OAuth" }],
    examples: [{ description: "Login with API key", command: "d3vonn auth login --key d3v_abc123" }], handler: "login", requiresAuth: false,
  },
  {
    name: "publish", category: "plugins", description: "Publish a plugin to the marketplace", usage: "d3vonn plugins publish <path>",
    args: [{ name: "path", type: "string", required: true, description: "Plugin directory path" }],
    flags: [{ name: "dry-run", type: "boolean", description: "Validate without publishing" }],
    examples: [{ description: "Publish plugin", command: "d3vonn plugins publish ./my-plugin" }], handler: "publishPlugin", requiresAuth: true, minPermission: "developer",
  },
  {
    name: "tail", category: "logs", description: "Stream real-time logs", usage: "d3vonn logs tail [--agent <id>] [--level <level>]",
    args: [], flags: [{ name: "agent", short: "a", type: "string", description: "Agent ID filter" }, { name: "level", short: "l", type: "string", description: "Log level filter" }],
    examples: [{ description: "Stream agent logs", command: "d3vonn logs tail --agent hermes --level error" }], handler: "tailLogs", requiresAuth: true,
  },
];

export function createCliRegistry(): CliRegistry {
  const registry = new CliRegistry();
  DEFAULT_COMMANDS.forEach((cmd) => registry.registerCommand(cmd));
  return registry;
}
