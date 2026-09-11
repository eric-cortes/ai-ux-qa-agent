import dns from "node:dns/promises";
import net from "node:net";

export function parseAllowedDomains(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesAllowedDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isBlockedHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export function isLocalAddress(address: string): boolean {
  return (net.isIPv4(address) && address.startsWith("127.")) || address === "::1";
}

export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b, c, d] = address.split(".").map(Number);
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254 && c === 169 && d === 254)
    );
  }

  if (net.isIPv6(address)) {
    return address === "::1";
  }

  return false;
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve target hostname: ${hostname}`);
  }

  return results.map((result) => result.address);
}

export async function assertSafeTarget(
  targetUrl: string,
  allowedDomains: string[],
  allowLocalTargets = false,
): Promise<void> {
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported target URL protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalHostname = isBlockedHostname(hostname);
  if (isLocalHostname && !allowLocalTargets) {
    throw new Error(`Blocked target hostname: ${hostname}`);
  }

  if (
    allowedDomains.length > 0 &&
    !allowedDomains.some((domain) => matchesAllowedDomain(hostname, domain)) &&
    !(allowLocalTargets && isLocalHostname)
  ) {
    throw new Error(`Target hostname is not in TARGET_URL_ALLOWED_DOMAINS: ${hostname}`);
  }

  const addresses = await resolveHostname(hostname);
  for (const address of addresses) {
    if (isBlockedAddress(address) && !(allowLocalTargets && isLocalAddress(address))) {
      throw new Error(`Blocked target address resolved for ${hostname}: ${address}`);
    }
  }
}
