/**
 * D3VONN Platform Knowledge Graph — Entry Point
 * 
 * Provides a ready-to-use platform graph instance with all nodes and edges
 * connected. This is the primary import for any module that needs to query
 * the platform knowledge graph.
 * 
 * Usage:
 *   import { graph, queries } from "@/knowledge/graph";
 *   const health = queries.queryPlatformHealth(graph);
 *   const bestAgent = queries.queryBestAgentForTask(graph, ["code-review"]);
 * 
 * @module knowledge/graph
 * @version 1.0.0
 */

export { PlatformKnowledgeGraph } from "./engine";
export type { GraphNode, GraphEdge, NodeType, EdgeType, TraversalResult, QueryFilter, ImpactAnalysis } from "./engine";
export { loadPlatformGraph, getPlatformGraph, resetPlatformGraph } from "./loader";
export * as queries from "./queries/hermes-queries";
