package terraform.aws.eks

import input.plan as tfplan

# ── Deny: EKS cluster with public API endpoint in production ──────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_cluster"
    resource.change.after.tags.Environment == "production"
    resource.change.after.kubernetes_network_config[_].endpoint_public_access == true
    reason := sprintf(
        "EKS cluster '%s': public API endpoint must be disabled in production. Use VPN or bastion.",
        [resource.address]
    )
}

# ── Deny: EKS cluster without secrets encryption ─────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_cluster"
    not resource.change.after.encryption_config
    reason := sprintf(
        "EKS cluster '%s': secrets encryption (KMS) must be configured.",
        [resource.address]
    )
}

# ── Deny: EKS cluster without control plane logging ──────────────────────────
required_log_types = {"api", "audit", "authenticator", "controllerManager", "scheduler"}

deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_cluster"
    enabled_logs := {log | log := resource.change.after.enabled_cluster_log_types[_]}
    missing := required_log_types - enabled_logs
    count(missing) > 0
    reason := sprintf(
        "EKS cluster '%s': missing control plane log types: %v",
        [resource.address, missing]
    )
}

# ── Deny: Node groups using t2 or t3.micro (too small for production) ─────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_node_group"
    resource.change.after.tags.Environment == "production"
    instance_type := resource.change.after.instance_types[_]
    regex.match("^t[23]\\.(nano|micro|small)$", instance_type)
    reason := sprintf(
        "EKS node group '%s': instance type '%s' is too small for production workloads.",
        [resource.address, instance_type]
    )
}

# ── Deny: Node groups without auto-scaling ────────────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_node_group"
    scaling := resource.change.after.scaling_config[_]
    scaling.min_size == scaling.max_size
    resource.change.after.tags.Environment == "production"
    reason := sprintf(
        "EKS node group '%s': min_size equals max_size — auto-scaling is disabled in production.",
        [resource.address]
    )
}

# ── Deny: Missing required tags on node groups ────────────────────────────────
required_tags = ["Environment", "CostCenter", "Project", "Owner"]

deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_eks_node_group"
    tag := required_tags[_]
    not resource.change.after.tags[tag]
    reason := sprintf(
        "EKS node group '%s': missing required tag '%s'.",
        [resource.address, tag]
    )
}
