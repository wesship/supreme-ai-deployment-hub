# D3VONN Platform Knowledge Graph

The Platform Knowledge Graph is the central reasoning substrate for Hermes and the D3VONN orchestration layer. It maps every route, agent, workflow, integration, security policy, and DKOS module into a single queryable graph that enables intelligent task routing, impact analysis, and platform health monitoring.

## Architecture

```
knowledge/graph/
├── schema/
│   └── graph-schema.yaml       # Formal schema (node types, edge types, constraints)
├── seed/
│   ├── platform-graph.json     # Complete platform seed data
│   └── route-taxonomy.json     # Route taxonomy with agent assignments
├── queries/
│   ├── hermes-queries.ts       # Low-level graph query functions
│   └── hermes-interface.ts     # High-level Hermes reasoning interface
├── engine.ts                   # TypeScript in-memory graph engine
├── loader.ts                   # TypeScript seed data loader
├── graph_engine.py             # Python graph engine (for FastAPI/backend)
├── visualize.py                # Mermaid diagram generator
├── validate_graph.py           # Graph integrity validation
├── index.ts                    # Module entry point
└── README.md                   # This file
```

## Graph Statistics

| Metric | Count |
|--------|-------|
| Total Nodes | 112 |
| Total Edges | 193 |
| Agents | 8 |
| Routes | 52 |
| Workflows | 7 |
| Integrations | 8 |
| Security Policies | 6 |
| Knowledge Modules | 5 |
| Events | 14 |
| Pillars | 7 |
| RBAC Roles | 5 |

## Usage

### TypeScript (Frontend / Node.js)

```typescript
import { getPlatformGraph, queries } from "@/knowledge/graph";
import seedData from "./seed/platform-graph.json";
import routeTaxonomy from "./seed/route-taxonomy.json";

const graph = getPlatformGraph(seedData, routeTaxonomy);

// Find the best agent for a task
const candidates = queries.queryBestAgentForTask(graph, ["code-review", "debugging"]);

// Check platform health
const health = queries.queryPlatformHealth(graph);

// Analyze impact of an agent failure
const impact = graph.impactAnalysis("hermes");
```

### Hermes Reasoning Interface

```typescript
import { HermesReasoningInterface } from "@/knowledge/graph/queries/hermes-interface";

const hermes = new HermesReasoningInterface(graph);

// Route a task
const decision = hermes.routeTask("task-123", ["vulnerability", "scanning"]);
// → { selectedAgent: "security-sentinel", confidence: 1.0, ... }

// Health check
const health = hermes.healthCheck();
// → { status: "healthy", activeAgents: 8, securityCoverage: 100, ... }

// Incident response
const incident = hermes.generateIncidentContext("code-engineer");
// → { impact: { routes: [...], riskLevel: "medium" }, fallbackPlan: { ... } }
```

### Python (Backend / FastAPI)

```python
from knowledge.graph.graph_engine import get_platform_graph

graph = get_platform_graph()

# Find agents for a capability
agents = graph.find_agents_for_capability("code-review")

# Platform health
health = graph.platform_health()

# Event cascade analysis
cascade = graph.event_cascade("SecurityAlertRaised")
```

### Visualization

```bash
# Generate overview diagram
python knowledge/graph/visualize.py --output docs/graphs/overview.mmd

# Focus on a specific agent
python knowledge/graph/visualize.py --focus hermes --output docs/graphs/hermes.mmd

# Event flow diagram
python knowledge/graph/visualize.py --event TaskCreated --output docs/graphs/task-flow.mmd

# Security posture
python knowledge/graph/visualize.py --security --output docs/graphs/security.mmd
```

### Validation

```bash
python knowledge/graph/validate_graph.py
```

## Key Queries for Hermes

| Query | Purpose |
|-------|---------|
| `queryBestAgentForTask` | Task routing — match keywords to agent capabilities |
| `queryAgentFailureImpact` | Incident response — assess blast radius |
| `querySecurityPosture` | Compliance — check policy coverage |
| `queryEventCascade` | Observability — trace event propagation |
| `queryPlatformHealth` | Monitoring — overall system health |
| `queryCriticalIntegrations` | Risk — identify single points of failure |
| `queryFullRouteDependencies` | Context — full dependency chain for a route |

## Schema

The graph schema is formally defined in `schema/graph-schema.yaml` and supports the following node types and relationships:

**Node Types:** Agent, Route, Workflow, Integration, SecurityPolicy, KnowledgeModule, Event, Pillar, RBACRole

**Edge Types:** SERVES, BELONGS_TO, ORCHESTRATES, DELEGATES_TO, USES_INTEGRATION, ENFORCES, QUERIES, PUBLISHES, SUBSCRIBES_TO, HAS_TOOL, REQUIRES_ROLE, PART_OF

## Extending the Graph

To add new nodes or edges, update the seed data in `seed/platform-graph.json` and/or `seed/route-taxonomy.json`, then run the validation script to ensure integrity. The graph engine will automatically pick up changes on next load.
