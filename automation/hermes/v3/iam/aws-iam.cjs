"use strict";
/**
 * hermes/v3/iam/aws-iam.cjs
 *
 * Hermes v3 — AWS IAM Introspection Analyzer
 */

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

const DANGEROUS_MANAGED_POLICIES = [
  "AdministratorAccess",
  "PowerUserAccess",
  "IAMFullAccess",
  "AWSFullAccess",
  "arn:aws:iam::aws:policy/AdministratorAccess",
];

const AWS_SERVICE_PRINCIPAL_PATTERN = /Service\s*=\s*"[a-z0-9.-]+\.amazonaws\.com"|"Service"\s*:\s*"[a-z0-9.-]+\.amazonaws\.com"/i;
const ASSUME_ROLE_PATTERN = /sts:AssumeRole/i;

function isServiceTrustPolicy(diff) {
  return ASSUME_ROLE_PATTERN.test(diff) && AWS_SERVICE_PRINCIPAL_PATTERN.test(diff);
}

function analyzeIAM(diff, files) {
  const iamFiles = files.filter((f) =>
    /iam|role|policy|permission|trust/i.test(f) ||
    /\.(tf|json|yaml|yml)$/.test(f)
  );

  if (iamFiles.length === 0 && !/iam:|aws_iam/i.test(diff)) {
    return { hasIAMChanges: false, findings: [], riskLevel: "none" };
  }

  const findings = [];
  const serviceTrustPolicy = isServiceTrustPolicy(diff);

  const foundEscalationActions = PRIVILEGE_ESCALATION_ACTIONS.filter((action) =>
    diff.includes(action) && !(action === "sts:AssumeRole" && serviceTrustPolicy)
  );

  if (foundEscalationActions.length > 0) {
    findings.push({
      type: "privilege_escalation",
      severity: "critical",
      message: `Privilege escalation actions detected: ${foundEscalationActions.join(", ")}`,
      remediation: "Ensure these actions are scoped to specific resources, not wildcards",
    });
  }

  if (serviceTrustPolicy) {
    findings.push({
      type: "service_trust_policy",
      severity: "medium",
      message: "AWS service trust policy detected for sts:AssumeRole",
      remediation: "Confirm the service principal is expected and scoped to the intended AWS service",
    });
  }

  if (/"Resource"\s*:\s*"\*"/.test(diff) || /resource\s*=\s*"\*"/.test(diff)) {
    findings.push({
      type: "wildcard_resource",
      severity: "high",
      message: 'Wildcard resource grant detected ("Resource": "*")',
      remediation: "Scope IAM permissions to specific resource ARNs instead of wildcards",
    });
  }

  const foundDangerousPolicies = DANGEROUS_MANAGED_POLICIES.filter((p) => diff.includes(p));
  if (foundDangerousPolicies.length > 0) {
    findings.push({
      type: "dangerous_managed_policy",
      severity: "critical",
      message: `Broad managed policy attached: ${foundDangerousPolicies.join(", ")}`,
      remediation: "Use least-privilege custom policies instead of broad managed policies",
    });
  }

  if (/aws_iam_user|"Type"\s*:\s*"AWS::IAM::User"/.test(diff)) {
    findings.push({
      type: "iam_user_creation",
      severity: "medium",
      message: "IAM user creation detected — prefer IAM roles over users",
      remediation: "Use IAM roles with temporary credentials instead of long-lived IAM users",
    });
  }

  if (/sts:AssumeRole.*\d{12}|Principal.*\d{12}/.test(diff)) {
    findings.push({
      type: "cross_account_trust",
      severity: "high",
      message: "Cross-account trust relationship detected",
      remediation: "Verify the trusted account ID and ensure external ID conditions are set",
    });
  }

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

module.exports = {
  analyzeIAM,
  PRIVILEGE_ESCALATION_ACTIONS,
  DANGEROUS_MANAGED_POLICIES,
  isServiceTrustPolicy,
};
