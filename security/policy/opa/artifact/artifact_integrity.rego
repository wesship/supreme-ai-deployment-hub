package artifact.integrity

import rego.v1

# ── Artifact Integrity Policy ──────────────────────────────────────────────
# Enforces Devonn.AI artifact requirements:
#   1. All release artifacts must have SLSA provenance attestation
#   2. SBOM must be present for production artifacts
#   3. Artifact SHA-256 digest must be recorded
#   4. Grype vulnerability scan must show 0 critical CVEs
#   5. Artifacts older than 90 days must not be promoted to production

# Deny if artifact lacks SLSA provenance
deny contains msg if {
    not input.provenance.slsa_level
    msg := "Artifact must have SLSA provenance attestation before deployment"
}

# Deny if SLSA level is below 2
deny contains msg if {
    input.provenance.slsa_level < 2
    msg := sprintf("Artifact SLSA level %v is below minimum required level 2", [input.provenance.slsa_level])
}

# Deny if SBOM is missing
deny contains msg if {
    not input.sbom
    msg := "Artifact must have an SBOM (CycloneDX or SPDX) before production deployment"
}

# Deny if SHA-256 digest is not recorded
deny contains msg if {
    not input.digest.sha256
    msg := "Artifact must have a recorded SHA-256 digest for integrity verification"
}

# Deny if critical CVEs exist in vulnerability scan
deny contains msg if {
    input.vulnerability_scan.critical_count > 0
    msg := sprintf("Artifact has %v critical CVEs - must be resolved before deployment", [input.vulnerability_scan.critical_count])
}

# Deny if high CVEs exceed threshold
deny contains msg if {
    input.vulnerability_scan.high_count > 5
    msg := sprintf("Artifact has %v high CVEs - exceeds maximum threshold of 5", [input.vulnerability_scan.high_count])
}

# Deny if artifact is too old for production
deny contains msg if {
    input.environment == "production"
    input.artifact_age_days > 90
    msg := sprintf("Artifact is %v days old - artifacts older than 90 days must be rebuilt before production deployment", [input.artifact_age_days])
}

allow if {
    count(deny) == 0
}

violations := deny
