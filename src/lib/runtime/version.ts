/**
 * Devonn.AI — Runtime Version Module
 *
 * Exposes build metadata for the /version endpoint.
 * Populated from environment variables set at build time.
 */

import { z } from "zod";

export const VersionResponseSchema = z.object({
  version: z.string().min(1),
  build_sha: z.string().min(1),
  build_time: z.string().datetime(),
  environment: z.enum(["development", "staging", "production"]),
  runtime_harness_version: z.string().min(1),
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;

export function getVersionInfo(): VersionResponse {
  const env = (
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ENVIRONMENT) ||
    process.env.ENVIRONMENT ||
    "development"
  ) as "development" | "staging" | "production";

  const buildSha =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BUILD_SHA) ||
    process.env.BUILD_SHA ||
    "dev-local";

  const buildTime =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BUILD_TIME) ||
    process.env.BUILD_TIME ||
    new Date().toISOString();

  const version =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_APP_VERSION) ||
    process.env.npm_package_version ||
    "0.0.0-dev";

  return {
    version,
    build_sha: buildSha,
    build_time: buildTime,
    environment: env,
    runtime_harness_version: "31.0.0",
  };
}
