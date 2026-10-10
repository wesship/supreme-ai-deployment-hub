
// Barrel file to re-export all manifest data
import { deploymentManifestYaml } from './deploymentManifest.cjs';
import { terraformManifestYaml } from './terraformManifest.cjs';
import { deploymentFilesText } from './deploymentFiles.cjs';

// Combine the deployment and terraform YAML for backwards compatibility
export const yamlCode = `${deploymentManifestYaml}

${terraformManifestYaml}`;

// Export the deployment files list
export const deploymentFiles = deploymentFilesText;

// Export individual sections for more granular use
export {
  deploymentManifestYaml,
  terraformManifestYaml,
  deploymentFilesText
};
