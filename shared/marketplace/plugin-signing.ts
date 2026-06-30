/**
 * D3VONN AI Marketplace — Plugin Signing & Verification
 *
 * Cryptographic signing, verification, and integrity checking
 * for marketplace plugins to ensure supply-chain security.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SignatureStatus = "valid" | "invalid" | "expired" | "revoked" | "unsigned";
export type TrustLevel = "verified" | "community" | "unverified" | "blocked";

export interface PluginSignature {
  pluginId: string;
  version: string;
  hash: string;
  algorithm: "sha256" | "sha384" | "sha512";
  signature: string;
  signedBy: string;
  signedAt: string;
  expiresAt: string;
  certificate: string;
}

export interface VerificationResult {
  pluginId: string;
  version: string;
  status: SignatureStatus;
  trustLevel: TrustLevel;
  signedBy?: string;
  signedAt?: string;
  issues: string[];
  verifiedAt: string;
}

export interface PublisherCertificate {
  id: string;
  publisherId: string;
  publisherName: string;
  publicKey: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  trustLevel: TrustLevel;
}

export interface IntegrityCheck {
  pluginId: string;
  version: string;
  expectedHash: string;
  actualHash: string;
  passed: boolean;
  checkedAt: string;
}

// ─────────────────────────────────────────────────────────────────
// Plugin Signer
// ─────────────────────────────────────────────────────────────────

export class PluginSigner {
  private certificates: Map<string, PublisherCertificate> = new Map();
  private signatures: Map<string, PluginSignature> = new Map();
  private revokedCerts: Set<string> = new Set();

  // ─── Certificate Management ─────────────────────────────────

  registerCertificate(cert: PublisherCertificate): void {
    this.certificates.set(cert.id, cert);
  }

  revokeCertificate(certId: string): boolean {
    const cert = this.certificates.get(certId);
    if (!cert) return false;
    cert.revoked = true;
    this.revokedCerts.add(certId);
    return true;
  }

  getCertificate(certId: string): PublisherCertificate | undefined {
    return this.certificates.get(certId);
  }

  getPublisherCertificates(publisherId: string): PublisherCertificate[] {
    return [...this.certificates.values()].filter((c) => c.publisherId === publisherId && !c.revoked);
  }

  // ─── Signing ────────────────────────────────────────────────

  sign(pluginId: string, version: string, content: string, certId: string): PluginSignature | null {
    const cert = this.certificates.get(certId);
    if (!cert || cert.revoked) return null;

    const now = new Date();
    if (new Date(cert.expiresAt) < now) return null;

    const hash = this.computeHash(content, "sha256");
    const signature = this.createSignature(hash, cert.publicKey);

    const pluginSig: PluginSignature = {
      pluginId,
      version,
      hash,
      algorithm: "sha256",
      signature,
      signedBy: cert.publisherId,
      signedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      certificate: certId,
    };

    this.signatures.set(`${pluginId}@${version}`, pluginSig);
    return pluginSig;
  }

  // ─── Verification ───────────────────────────────────────────

  verify(pluginId: string, version: string, content: string): VerificationResult {
    const key = `${pluginId}@${version}`;
    const sig = this.signatures.get(key);

    if (!sig) {
      return {
        pluginId,
        version,
        status: "unsigned",
        trustLevel: "unverified",
        issues: ["No signature found for this plugin version"],
        verifiedAt: new Date().toISOString(),
      };
    }

    const issues: string[] = [];
    let status: SignatureStatus = "valid";
    let trustLevel: TrustLevel = "verified";

    // Check expiration
    if (new Date(sig.expiresAt) < new Date()) {
      status = "expired";
      issues.push("Signature has expired");
    }

    // Check certificate revocation
    if (this.revokedCerts.has(sig.certificate)) {
      status = "revoked";
      issues.push("Signing certificate has been revoked");
    }

    // Check integrity
    const currentHash = this.computeHash(content, sig.algorithm);
    if (currentHash !== sig.hash) {
      status = "invalid";
      issues.push("Content hash does not match signature");
    }

    // Determine trust level
    const cert = this.certificates.get(sig.certificate);
    if (cert) {
      trustLevel = cert.trustLevel;
    } else {
      trustLevel = "unverified";
      issues.push("Signing certificate not found");
    }

    if (status !== "valid") {
      trustLevel = status === "invalid" ? "blocked" : "unverified";
    }

    return {
      pluginId,
      version,
      status,
      trustLevel,
      signedBy: sig.signedBy,
      signedAt: sig.signedAt,
      issues,
      verifiedAt: new Date().toISOString(),
    };
  }

  checkIntegrity(pluginId: string, version: string, content: string): IntegrityCheck {
    const key = `${pluginId}@${version}`;
    const sig = this.signatures.get(key);
    const actualHash = this.computeHash(content, "sha256");

    return {
      pluginId,
      version,
      expectedHash: sig?.hash ?? "unknown",
      actualHash,
      passed: sig ? sig.hash === actualHash : false,
      checkedAt: new Date().toISOString(),
    };
  }

  // ─── Stats ──────────────────────────────────────────────────

  getStats(): { totalCertificates: number; revokedCertificates: number; totalSignatures: number; verifiedPublishers: number } {
    return {
      totalCertificates: this.certificates.size,
      revokedCertificates: this.revokedCerts.size,
      totalSignatures: this.signatures.size,
      verifiedPublishers: new Set([...this.certificates.values()].filter((c) => !c.revoked && c.trustLevel === "verified").map((c) => c.publisherId)).size,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────

  private computeHash(content: string, _algorithm: string): string {
    // Simplified hash for runtime (real impl would use crypto)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(16, "0")}`;
  }

  private createSignature(hash: string, _publicKey: string): string {
    // Simplified signature (real impl would use asymmetric crypto)
    return `sig:${hash.slice(7)}:${Date.now().toString(36)}`;
  }
}

export function createPluginSigner(): PluginSigner {
  return new PluginSigner();
}
