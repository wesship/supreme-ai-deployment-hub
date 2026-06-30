/**
 * D3VONN Developer Platform — API Playground
 *
 * Interactive API testing environment with request builder,
 * response viewer, code generation, and saved collections.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type Language = "typescript" | "python" | "curl" | "go" | "ruby" | "java";

export interface PlaygroundRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  queryParams: Record<string, string>;
  auth: { type: string; value: string };
}

export interface PlaygroundResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  latency: number; // ms
  size: number; // bytes
  timestamp: string;
}

export interface PlaygroundCollection {
  id: string;
  name: string;
  description: string;
  requests: PlaygroundRequest[];
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  shared: boolean;
}

export interface CodeSnippet {
  language: Language;
  code: string;
  dependencies?: string[];
}

// ─────────────────────────────────────────────────────────────────
// Playground Engine
// ─────────────────────────────────────────────────────────────────

export class PlaygroundEngine {
  private collections: Map<string, PlaygroundCollection> = new Map();
  private history: { request: PlaygroundRequest; response: PlaygroundResponse }[] = [];

  // ─── Request Execution ──────────────────────────────────────

  async executeRequest(request: PlaygroundRequest): Promise<PlaygroundResponse> {
    const startTime = Date.now();

    // Simulated execution — in production this makes actual HTTP calls
    const response: PlaygroundResponse = {
      requestId: request.id,
      statusCode: 200,
      headers: { "content-type": "application/json", "x-request-id": `req_${Date.now()}` },
      body: { success: true, message: "Request executed successfully", data: {} },
      latency: Date.now() - startTime + Math.floor(Math.random() * 200),
      size: 256,
      timestamp: new Date().toISOString(),
    };

    this.history.push({ request, response });
    return response;
  }

  // ─── Code Generation ────────────────────────────────────────

  generateCode(request: PlaygroundRequest, language: Language): CodeSnippet {
    switch (language) {
      case "typescript": return this.generateTypeScript(request);
      case "python": return this.generatePython(request);
      case "curl": return this.generateCurl(request);
      case "go": return this.generateGo(request);
      default: return this.generateCurl(request);
    }
  }

  private generateTypeScript(req: PlaygroundRequest): CodeSnippet {
    const headers = Object.entries(req.headers).map(([k, v]) => `    "${k}": "${v}"`).join(",\n");
    const body = req.body ? `  body: JSON.stringify(${JSON.stringify(req.body, null, 2)}),\n` : "";

    return {
      language: "typescript",
      dependencies: ["node-fetch"],
      code: `import { D3vonnClient } from "@d3vonn/sdk";

const client = new D3vonnClient({ apiKey: "${req.auth.value}" });

const response = await fetch("${req.url}", {
  method: "${req.method}",
  headers: {
${headers}
  },
${body}});

const data = await response.json();
console.log(data);`,
    };
  }

  private generatePython(req: PlaygroundRequest): CodeSnippet {
    const headers = JSON.stringify(req.headers, null, 2);
    const body = req.body ? `json=${JSON.stringify(req.body, null, 2)}` : "";

    return {
      language: "python",
      dependencies: ["requests", "d3vonn-sdk"],
      code: `import requests
from d3vonn import D3vonnClient

client = D3vonnClient(api_key="${req.auth.value}")

response = requests.${req.method.toLowerCase()}(
    "${req.url}",
    headers=${headers},
    ${body}
)

print(response.json())`,
    };
  }

  private generateCurl(req: PlaygroundRequest): CodeSnippet {
    const headers = Object.entries(req.headers).map(([k, v]) => `-H "${k}: ${v}"`).join(" \\\n  ");
    const body = req.body ? `-d '${JSON.stringify(req.body)}'` : "";

    return {
      language: "curl",
      code: `curl -X ${req.method} "${req.url}" \\
  ${headers} \\
  ${body}`.trim(),
    };
  }

  private generateGo(req: PlaygroundRequest): CodeSnippet {
    return {
      language: "go",
      dependencies: ["net/http", "encoding/json"],
      code: `package main

import (
    "fmt"
    "net/http"
    "io/ioutil"
)

func main() {
    req, _ := http.NewRequest("${req.method}", "${req.url}", nil)
${Object.entries(req.headers).map(([k, v]) => `    req.Header.Set("${k}", "${v}")`).join("\n")}

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}`,
    };
  }

  // ─── Collections ────────────────────────────────────────────

  createCollection(collection: Omit<PlaygroundCollection, "id" | "createdAt" | "updatedAt">): PlaygroundCollection {
    const full: PlaygroundCollection = {
      ...collection,
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.collections.set(full.id, full);
    return full;
  }

  getCollection(collectionId: string): PlaygroundCollection | undefined {
    return this.collections.get(collectionId);
  }

  listCollections(): PlaygroundCollection[] {
    return [...this.collections.values()];
  }

  addToCollection(collectionId: string, request: PlaygroundRequest): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;
    collection.requests.push(request);
    collection.updatedAt = new Date().toISOString();
    return true;
  }

  // ─── History ────────────────────────────────────────────────

  getHistory(limit = 50): { request: PlaygroundRequest; response: PlaygroundResponse }[] {
    return this.history.slice(-limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}

export function createPlaygroundEngine(): PlaygroundEngine {
  return new PlaygroundEngine();
}
