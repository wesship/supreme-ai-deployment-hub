"use strict";
/**
 * hermes/analyzers/terraform.js
 *
 * Terraform-aware diff analyzer for Hermes v2.
 * Detects high-risk infrastructure changes that warrant additional review.
 */

const HIGH_RISK_RESOURCES = [
  "aws_iam_role",
  "aws_iam_policy",
  "aws_iam_user",
  "aws_security_group",
  "aws_vpc",
  "aws_subnet",
  "aws_s3_bucket",
  "aws_rds_instance",
  "aws_eks_cluster",
  "aws_kms_key",
  "google_iam_binding",
  "azurerm_role_assignment",
];

/**
 * Analyze a diff for Terraform-specific risk signals.
 *
 * @param {string} diff - The git diff string
 * @param {string[]} files - List of changed file paths
 * @returns {{ hasTerraformChanges: boolean, highRiskResources: string[], destroyOperations: boolean }}
 */
function analyzeTerraform(diff, files) {
  const hasTerraformChanges = files.some((f) => /\.(tf|tfvars)$/.test(f));

  if (!hasTerraformChanges) {
    return { hasTerraformChanges: false, highRiskResources: [], destroyOperations: false };
  }

  const highRiskResources = HIGH_RISK_RESOURCES.filter((resource) =>
    diff.includes(`resource "${resource}"`) || diff.includes(`resource '${resource}'`)
  );

  // Detect `terraform destroy` or `-/+ destroy` patterns in plan output
  const destroyOperations = /\-\/\+ destroy|will be destroyed|Plan: \d+ to destroy/.test(diff);

  return {
    hasTerraformChanges,
    highRiskResources,
    destroyOperations,
  };
}

module.exports = { analyzeTerraform };
