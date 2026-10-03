export type HostingProviderId =
  | "vercel"
  | "railway"
  | "self-hosted"
  | "cloudflare"
  | "custom";

export type DnsProviderId =
  | "cloudflare"
  | "route53"
  | "self-hosted"
  | "custom";

export type DomainMode = "platform-subdomain" | "custom-domain";

export interface HostingProviderConfig {
  id: HostingProviderId;
  enabled: boolean;
  apiBaseUrl?: string;
  region?: string;
}

export interface DnsProviderConfig {
  id: DnsProviderId;
  enabled: boolean;
  zoneId?: string;
  apiBaseUrl?: string;
}

export interface DomainZoneConfig {
  /** Root domain used for automatically issued project hostnames. */
  rootDomain: string;
  /** Template is deliberately root-domain independent so the platform can switch domains. */
  hostnameTemplate: "{slug}.{rootDomain}";
  dnsProvider: DnsProviderId;
  wildcardEnabled: boolean;
  customDomainsEnabled: boolean;
}

export interface HostingPlatformConfig {
  activeHostingProvider: HostingProviderId;
  activeDomainZone: string;
  hostingProviders: HostingProviderConfig[];
  domainZones: DomainZoneConfig[];
}

const env = import.meta.env;

/**
 * D3VONN hosting control-plane configuration.
 *
 * No application logic should hard-code d3vonn.io. The active root domain,
 * DNS provider and hosting provider are selected here so a future domain or
 * infrastructure migration is configuration-only.
 */
export const hostingPlatformConfig: HostingPlatformConfig = {
  activeHostingProvider:
    (env.VITE_HOSTING_PROVIDER as HostingProviderId | undefined) ?? "vercel",
  activeDomainZone: env.VITE_PLATFORM_ROOT_DOMAIN ?? "d3vonn.io",
  hostingProviders: [
    { id: "vercel", enabled: true },
    { id: "railway", enabled: true },
    { id: "self-hosted", enabled: true },
    { id: "cloudflare", enabled: true },
    { id: "custom", enabled: true },
  ],
  domainZones: [
    {
      rootDomain: env.VITE_PLATFORM_ROOT_DOMAIN ?? "d3vonn.io",
      hostnameTemplate: "{slug}.{rootDomain}",
      dnsProvider:
        (env.VITE_DNS_PROVIDER as DnsProviderId | undefined) ?? "cloudflare",
      wildcardEnabled: true,
      customDomainsEnabled: true,
    },
  ],
};

const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

export function getActiveDomainZone(
  config: HostingPlatformConfig = hostingPlatformConfig,
): DomainZoneConfig {
  const active = normalizeDomain(config.activeDomainZone);
  return (
    config.domainZones.find(
      (zone) => normalizeDomain(zone.rootDomain) === active,
    ) ?? config.domainZones[0]
  );
}

export function projectHostname(
  slug: string,
  zone: DomainZoneConfig = getActiveDomainZone(),
): string {
  const safeSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!safeSlug) throw new Error("Project slug must contain a letter or number");

  return zone.hostnameTemplate
    .replace("{slug}", safeSlug)
    .replace("{rootDomain}", normalizeDomain(zone.rootDomain));
}

export function projectUrl(slug: string, zone?: DomainZoneConfig): string {
  return `https://${projectHostname(slug, zone)}`;
}

export function customDomainRecord(
  hostname: string,
  platformTarget: string,
): { type: "CNAME"; name: string; value: string } {
  return {
    type: "CNAME",
    name: normalizeDomain(hostname),
    value: normalizeDomain(platformTarget),
  };
}
