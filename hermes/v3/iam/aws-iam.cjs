"use strict";
/**
 * hermes/v3/iam/aws-iam.cjs
 *
 * Hermes v3 — AWS IAM Introspection Analyzer
 *
 * Analyzes git diffs for IAM-related changes and flags high-risk permission
 * patterns. Works without AWS API access (static analysis only) but can be
 * extended to call `aws iam simulate-principal-policy` when AWS credentials
 * are available in the CI environment.
 *
 * Detects:
 *   - Privilege escalation patterns (iam:PassRole, iam:CreateRole, etc.)
 *   - Wildcard resource grants ("Resource": "*")
 *   - Admin policy attachments (AdministratorAccess, PowerUserAccess)
 *   - IAM user creation (should use roles instead)
 *   - Inline policy additions
 *   - Cross-account trust relationships
 */

// High-risk IAM actions that can lead to privilege escalation
const PRIVILEGE_ESCALATION_ACTIONS = [
  "iam:CreateRole",
  "iam:AttachRolePolicy",
  "iam:PutRolePolicy",
  "iam:PassRole",
  "iam:CreatePolicyVersion",
  "iam:SetDefaultPolicyVersion",
  "iam:CreateUser",
  "iam:AttachUserPolicy",
  "iam:PutUserPolicy",
  "iam:AddUserToGroup",
  "iam:CreateAccessKey",
  "sts:AssumeRole",
];

// Managed policies that grant broad access
const DANGEROUS_MANAGED_POLICIES = [
  "AdministratorAccess",
  "PowerUserAccess",
  "IAMFullAccess",
  "AWSFullAccess",
  "arn:aws:iam::aws:policy/AdministratorAccess",
];

/**
 * Analyze a diff for AWS IAM risk patterns.
 *
 * @param {string} diff - The git diff string
 * @param {string[]} files - Changed file paths
 * @returns {object} IAM analysis result
 */
function analyzeIAM(diff, files) {
  const iamFiles = files.filter((f) =>
    /iam|role|policy|permission|trust/i.test(f) ||
    /\.(tf|json|yaml|yml)$/.test(f)
  );

  if (iamFiles.length === 0 && !/iam:|aws_iam/i.test(diff)) {
    return {
      hasIAMChanges: false,
      findings: [],
      riskLevel: "none",
    };
  }

  const findings = [];

  // Check for privilege escalation actions
  const foundEscalationActions = PRIVILEGE_ESCALATION_ACTIONS.filter((action) =>
    diff.includes(action)
  );
  if (foundEscalationActions.length > 0) {
    findings.push({
      type: "privilege_escalation",
      severity: "critical",
      message: `Privilege escalation actions detected: ${foundEscalationActions.join(", ")}`,
      remediation: "Ensure these actions are scoped to specific resources, not wildcards",
    });
  }

  // Check for wildcard resource grants
  if (/"Resource"\s*:\s*"\*"/.test(diff) || /resource\s*=\s*"\*"/.test(diff)) {
    findings.push({
      type: "wildcard_resource",
      severity: "high",
      message: 'Wildcard resource grant detected ("Resource": "*")',
      remediation: "Scope IAM permissions to specific resource ARNs instead of wildcards",
    });
  }

  // Check for dangerous managed policy attachments
  const foundDangerousPolicies = DANGEROUS_MANAGED_POLICIES.filter((p) =>
    diff.includes(p)
  );
  if (foundDangerousPolicies.length > 0) {
    findings.push({
      type: "dangerous_managed_policy",
      severity: "critical",
      message: `Broad managed policy attached: ${foundDangerousPolicies.join(", ")}`,
      remediation: "Use least-privilege custom policies instead of broad managed policies",
    });
  }

  // Check for IAM user creation (should use roles)
  if (/aws_iam_user|"Type"\s*:\s*"AWS::IAM::User"/.test(diff)) {
    findings.push({
      type: "iam_user_creation",
      severity: "medium",
      message: "IAM user creation detected — prefer IAM roles over users",
      remediation: "Use IAM roles with temporary credentials instead of long-lived IAM users",
    });
  }

  // Check for cross-account trust relationships
  if (/sts:AssumeRole.*\d{12}|Principal.*\d{12}/.test(diff)) {
    findings.push({
      type: "cross_account_trust",
      severity: "high",
      message: "Cross-account trust relationship detected",
      remediation: "Verify the trusted account ID and ensure external ID conditions are set",
    });
  }

  // Determine overall risk level
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");
  const riskLevel = hasCritical ? "critical" : hasHigh ? "high" : findings.length > 0 ? "medium" : "low";

  return {
    hasIAMChanges: true,
    iamFiles,
    findings,
    riskLevel,
    summary: findings.length === 0
      ? "IAM changes detected but no high-risk patterns found"
      : `${findings.length} IAM risk finding(s) detected`,
  };
}

module.exports = { analyzeIAM, PRIVILEGE_ESCALATION_ACTIONS, DANGEROUS_MANAGED_POLICIES };
