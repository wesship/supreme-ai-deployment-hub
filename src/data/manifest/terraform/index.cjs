
// Main export file for Terraform configuration
import { commonConfigYaml } from './common.cjs';
import { vpcConfigYaml } from './vpc.cjs';
import { eksConfigYaml } from './eks.cjs'; 
import { rdsConfigYaml } from './rds.cjs';
import { kubernetesConfigYaml } from './kubernetes.cjs';
import { variablesConfigYaml } from './variables.cjs';
import { outputsConfigYaml } from './outputs.cjs';
import { securityConfigYaml } from './security.cjs';
import { serviceMeshYaml } from './service-mesh/index.cjs';

// Combine all Terraform configuration sections
export const terraformManifestYaml = `${commonConfigYaml}

${vpcConfigYaml}

${eksConfigYaml}

${rdsConfigYaml}

${kubernetesConfigYaml}

${securityConfigYaml}

${serviceMeshYaml}

${variablesConfigYaml}

${outputsConfigYaml}`;

// // Import Azure Terraform files as raw text
// import mainTf from './azure/main.tf?raw';
// import variablesTf from './azure/variables.tf?raw';
// import outputsTf from './azure/outputs.tf?raw';


try {
  // your logic to synthesize Terraform configuration
  console.log("Running cdktf synth...");
} catch (err) {
  console.error("Error during execution:", err);
}

// Export Azure Container Apps Terraform configuration
// export const azureContainerAppsTerraform = {
//   mainTf,
//   variablesTf,
//   outputsTf
// };
