import { describe, expect, it } from "vitest";

import {
  assertSafeTarget,
  isBlockedAddress,
  isBlockedHostname,
  matchesAllowedDomain,
  parseAllowedDomains,
} from "./ssrf";

describe("isBlockedAddress", () => {
  it("blocks loopback, private, and metadata addresses", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.0.0.5")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // example.com
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost variants", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("app.localhost")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("matchesAllowedDomain", () => {
  it("matches by exact host and subdomain", () => {
    expect(matchesAllowedDomain("example.com", "example.com")).toBe(true);
    expect(matchesAllowedDomain("staging.example.com", "example.com")).toBe(true);
    expect(matchesAllowedDomain("evil.com", "example.com")).toBe(false);
  });
});

describe("parseAllowedDomains", () => {
  it("parses a comma list and lowercases", () => {
    expect(parseAllowedDomains(" A.com , b.com ")).toEqual(["a.com", "b.com"]);
    expect(parseAllowedDomains(undefined)).toEqual([]);
  });
});

describe("assertSafeTarget (IP literals only — no DNS)", () => {
  it("rejects blocked targets", async () => {
    await expect(assertSafeTarget("http://127.0.0.1/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://localhost/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://169.254.169.254/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://192.168.1.1/", [])).rejects.toThrow();
    await expect(assertSafeTarget("file:///etc/passwd", [])).rejects.toThrow();
  });

  it("allows a public IP literal", async () => {
    await expect(assertSafeTarget("http://93.184.216.34/", [])).resolves.toBeUndefined();
  });

  it("enforces the allowlist against a public IP literal", async () => {
    await expect(assertSafeTarget("http://93.184.216.34/", ["example.com"])).rejects.toThrow();
  });
});
