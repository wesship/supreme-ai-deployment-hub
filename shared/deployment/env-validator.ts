/**
 * D3VONN Environment Validator
 *
 * Validates that all required environment variables are present and correctly
 * configured for each deployment target (development, staging, production).
 *
 * @module shared/deployment/env-validator
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type Environment = "development" | "staging" | "production";

export type VarCategory =
  | "core"
  | "database"
  | "auth"
  | "ai"
  | "storage"
  | "monitoring"
  | "deployment"
  | "messaging"
  | "search";

export interface EnvVarDefinition {
  name: string;
  category: VarCategory;
  required: boolean;
  environments: Environment[];
  description: string;
  pattern?: RegExp;
  sensitive?: boolean;
  defaultValue?: string;
}

export interface ValidationResult {
  variable: string;
  category: VarCategory;
  status: "present" | "missing" | "invalid" | "default";
  message: string;
  sensitive: boolean;
}

export interface EnvironmentReport {
  environment: Environment;
  timestamp: string;
  results: ValidationResult[];
  summary: {
    total: number;
    present: number;
    missing: number;
    invalid: number;
    defaults: number;
    score: number;
  };
  categories: Record<VarCategory, { total: number; valid: number; score: number }>;
}

// ─────────────────────────────────────────────────────────────────
// Required Environment Variables Registry
// ─────────────────────────────────────────────────────────────────

export const ENV_VAR_REGISTRY: EnvVarDefinition[] = [
  // Core
  { name: "NODE_ENV", category: "core", required: true, environments: ["development", "staging", "production"], description: "Runtime environment", pattern: /^(development|staging|production|test)$/ },
  { name: "APP_URL", category: "core", required: true, environments: ["staging", "production"], description: "Public application URL", pattern: /^https?:\/\// },
  { name: "API_URL", category: "core", required: true, environments: ["staging", "production"], description: "API base URL", pattern: /^https?:\/\// },
  { name: "APP_VERSION", category: "core", required: false, environments: ["production"], description: "Application version", pattern: /^\d+\.\d+\.\d+/ },

  // Database
  { name: "DATABASE_URL", category: "database", required: true, environments: ["development", "staging", "production"], description: "PostgreSQL connection string", pattern: /^postgres(ql)?:\/\//, sensitive: true },
  { name: "SUPABASE_URL", category: "database", required: true, environments: ["development", "staging", "production"], description: "Supabase project URL", pattern: /^https:\/\/.*\.supabase\.co/ },
  { name: "SUPABASE_ANON_KEY", category: "database", required: true, environments: ["development", "staging", "production"], description: "Supabase anonymous key", sensitive: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", category: "database", required: true, environments: ["staging", "production"], description: "Supabase service role key", sensitive: true },
  { name: "REDIS_URL", category: "database", required: false, environments: ["staging", "production"], description: "Redis connection URL", pattern: /^redis(s)?:\/\//, sensitive: true },

  // Auth
  { name: "JWT_SECRET", category: "auth", required: true, environments: ["development", "staging", "production"], description: "JWT signing secret", sensitive: true },
  { name: "SESSION_SECRET", category: "auth", required: true, environments: ["staging", "production"], description: "Session encryption secret", sensitive: true },
  { name: "OAUTH_CLIENT_ID", category: "auth", required: false, environments: ["staging", "production"], description: "OAuth client ID" },
  { name: "OAUTH_CLIENT_SECRET", category: "auth", required: false, environments: ["staging", "production"], description: "OAuth client secret", sensitive: true },

  // AI
  { name: "OPENAI_API_KEY", category: "ai", required: true, environments: ["development", "staging", "production"], description: "OpenAI API key", pattern: /^sk-/, sensitive: true },
  { name: "ANTHROPIC_API_KEY", category: "ai", required: false, environments: ["staging", "production"], description: "Anthropic API key", sensitive: true },
  { name: "PINECONE_API_KEY", category: "ai", required: true, environments: ["staging", "production"], description: "Pinecone vector DB key", sensitive: true },
  { name: "PINECONE_ENVIRONMENT", category: "ai", required: true, environments: ["staging", "production"], description: "Pinecone environment" },
  { name: "PINECONE_INDEX", category: "ai", required: true, environments: ["staging", "production"], description: "Pinecone index name" },

  // Storage
  { name: "S3_BUCKET", category: "storage", required: false, environments: ["staging", "production"], description: "S3 bucket name" },
  { name: "S3_ACCESS_KEY", category: "storage", required: false, environments: ["staging", "production"], description: "S3 access key", sensitive: true },
  { name: "S3_SECRET_KEY", category: "storage", required: false, environments: ["staging", "production"], description: "S3 secret key", sensitive: true },
  { name: "S3_REGION", category: "storage", required: false, environments: ["staging", "production"], description: "S3 region" },

  // Monitoring
  { name: "SENTRY_DSN", category: "monitoring", required: true, environments: ["staging", "production"], description: "Sentry DSN for error tracking", pattern: /^https:\/\/.*@.*\.ingest\.sentry\.io/ },
  { name: "SENTRY_AUTH_TOKEN", category: "monitoring", required: false, environments: ["production"], description: "Sentry auth token for releases", sensitive: true },
  { name: "LOG_LEVEL", category: "monitoring", required: false, environments: ["development", "staging", "production"], description: "Logging level", pattern: /^(debug|info|warn|error|fatal)$/, defaultValue: "info" },

  // Deployment
  { name: "RAILWAY_TOKEN", category: "deployment", required: false, environments: ["production"], description: "Railway deployment token", sensitive: true },
  { name: "VERCEL_TOKEN", category: "deployment", required: false, environments: ["production"], description: "Vercel deployment token", sensitive: true },
  { name: "DEPLOY_ENVIRONMENT", category: "deployment", required: true, environments: ["staging", "production"], description: "Target deployment environment" },

  // Messaging
  { name: "SLACK_WEBHOOK_URL", category: "messaging", required: false, environments: ["staging", "production"], description: "Slack webhook for notifications", pattern: /^https:\/\/hooks\.slack\.com/ },
  { name: "PAGERDUTY_KEY", category: "messaging", required: false, environments: ["production"], description: "PagerDuty integration key", sensitive: true },

  // Search
  { name: "ELASTICSEARCH_URL", category: "search", required: false, environments: ["staging", "production"], description: "Elasticsearch URL", pattern: /^https?:\/\// },
];

// ─────────────────────────────────────────────────────────────────
// Validator
// ─────────────────────────────────────────────────────────────────

export class EnvironmentValidator {
  private registry: EnvVarDefinition[];
  private envSource: Record<string, string | undefined>;

  constructor(
    registry?: EnvVarDefinition[],
    envSource?: Record<string, string | undefined>
  ) {
    this.registry = registry ?? ENV_VAR_REGISTRY;
    this.envSource = envSource ?? (typeof process !== "undefined" ? process.env : {});
  }

  validate(environment: Environment): EnvironmentReport {
    const applicableVars = this.registry.filter((v) =>
      v.environments.includes(environment)
    );

    const results: ValidationResult[] = applicableVars.map((varDef) => {
      const value = this.envSource[varDef.name];

      if (!value && !varDef.defaultValue) {
        if (varDef.required) {
          return {
            variable: varDef.name,
            category: varDef.category,
            status: "missing" as const,
            message: `Required variable ${varDef.name} is not set`,
            sensitive: varDef.sensitive ?? false,
          };
        }
        return {
          variable: varDef.name,
          category: varDef.category,
          status: "missing" as const,
          message: `Optional variable ${varDef.name} is not set`,
          sensitive: varDef.sensitive ?? false,
        };
      }

      if (!value && varDef.defaultValue) {
        return {
          variable: varDef.name,
          category: varDef.category,
          status: "default" as const,
          message: `Using default value for ${varDef.name}`,
          sensitive: varDef.sensitive ?? false,
        };
      }

      if (varDef.pattern && value && !varDef.pattern.test(value)) {
        return {
          variable: varDef.name,
          category: varDef.category,
          status: "invalid" as const,
          message: `${varDef.name} does not match expected pattern`,
          sensitive: varDef.sensitive ?? false,
        };
      }

      return {
        variable: varDef.name,
        category: varDef.category,
        status: "present" as const,
        message: `${varDef.name} is configured correctly`,
        sensitive: varDef.sensitive ?? false,
      };
    });

    const summary = {
      total: results.length,
      present: results.filter((r) => r.status === "present").length,
      missing: results.filter((r) => r.status === "missing").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      defaults: results.filter((r) => r.status === "default").length,
      score: 0,
    };
    summary.score = Math.round(
      ((summary.present + summary.defaults) / summary.total) * 100
    );

    const categories = {} as Record<VarCategory, { total: number; valid: number; score: number }>;
    const allCategories: VarCategory[] = ["core", "database", "auth", "ai", "storage", "monitoring", "deployment", "messaging", "search"];
    for (const cat of allCategories) {
      const catResults = results.filter((r) => r.category === cat);
      const valid = catResults.filter((r) => r.status === "present" || r.status === "default").length;
      categories[cat] = {
        total: catResults.length,
        valid,
        score: catResults.length > 0 ? Math.round((valid / catResults.length) * 100) : 100,
      };
    }

    return {
      environment,
      timestamp: new Date().toISOString(),
      results,
      summary,
      categories,
    };
  }

  getRequiredVars(environment: Environment): EnvVarDefinition[] {
    return this.registry.filter(
      (v) => v.required && v.environments.includes(environment)
    );
  }

  getSensitiveVars(): EnvVarDefinition[] {
    return this.registry.filter((v) => v.sensitive);
  }

  getByCategory(category: VarCategory): EnvVarDefinition[] {
    return this.registry.filter((v) => v.category === category);
  }

  addVariable(varDef: EnvVarDefinition): void {
    this.registry.push(varDef);
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createEnvironmentValidator(
  envSource?: Record<string, string | undefined>
): EnvironmentValidator {
  return new EnvironmentValidator(undefined, envSource);
}
