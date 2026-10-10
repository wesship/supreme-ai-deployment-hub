
// Main export file for service mesh configuration
import { coreMeshYaml } from './core.cjs';
import { nodesYaml } from './virtual-nodes.cjs';
import { servicesYaml } from './virtual-services.cjs';
import { routesYaml } from './routes.cjs';
import { observabilityYaml } from './observability.cjs';
import { kubernetesProxyYaml } from './kubernetes-proxy.cjs';

// Combine all service mesh configuration sections
export const serviceMeshYaml = `# --- AWS App Mesh Configuration ---

${coreMeshYaml}

${nodesYaml}

${servicesYaml}

${routesYaml}

${kubernetesProxyYaml}

${observabilityYaml}`;
