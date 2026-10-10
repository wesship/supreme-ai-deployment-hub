package terraform.aws.rds

import input.plan as tfplan

# ── Deny: Unencrypted storage ─────────────────────────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.storage_encrypted == false
    reason := sprintf(
        "RDS '%s': storage_encrypted must be true.",
        [resource.address]
    )
}

# ── Deny: Public access in production ────────────────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.publicly_accessible == true
    resource.change.after.tags.Environment == "production"
    reason := sprintf(
        "RDS '%s': publicly_accessible must be false in production.",
        [resource.address]
    )
}

# ── Deny: No deletion protection in production ────────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.tags.Environment == "production"
    resource.change.after.deletion_protection == false
    reason := sprintf(
        "RDS '%s': deletion_protection must be true in production.",
        [resource.address]
    )
}

# ── Deny: Multi-AZ disabled in production ────────────────────────────────────
deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.tags.Environment == "production"
    resource.change.after.multi_az == false
    reason := sprintf(
        "RDS '%s': multi_az must be true in production for HA.",
        [resource.address]
    )
}

# ── Warn: Backup retention < 7 days ──────────────────────────────────────────
warn[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.backup_retention_period < 7
    reason := sprintf(
        "RDS '%s': backup_retention_period is %d days (recommended: ≥7).",
        [resource.address, resource.change.after.backup_retention_period]
    )
}

# ── Warn: Enhanced monitoring disabled ───────────────────────────────────────
warn[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.monitoring_interval == 0
    reason := sprintf(
        "RDS '%s': enhanced monitoring is disabled.",
        [resource.address]
    )
}

# ── Deny: Missing required tags ──────────────────────────────────────────────
required_tags = ["Environment", "CostCenter", "Project", "Owner"]

deny[reason] {
    resource := tfplan.resource_changes[_]
    resource.type == "aws_db_instance"
    tag := required_tags[_]
    not resource.change.after.tags[tag]
    reason := sprintf(
        "RDS '%s': missing required tag '%s'.",
        [resource.address, tag]
    )
}
