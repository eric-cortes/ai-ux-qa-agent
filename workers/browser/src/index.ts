import "dotenv/config";

import dns from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type Locator, type Page } from "playwright";

const DEFAULT_GOTO_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RUNTIME_MS = 120_000;

async function main() {
  const targetUrl = process.env.TARGET_URL ?? "https://example.com";
  const artifactDir = process.env.ARTIFACT_LOCAL_DIR ?? "./storage/artifacts";
  const runId = process.env.RUN_ID ?? `run_${Date.now()}`;
  const loginEmail = process.env.TARGET_APP_LOGIN_EMAIL;
  const loginPassword = process.env.TARGET_APP_LOGIN_PASSWORD;
  const gotoTimeoutMs = parseInt(process.env.BROWSER_GOTO_TIMEOUT_MS ?? `${DEFAULT_GOTO_TIMEOUT_MS}`, 10);
  const maxRuntimeMs = parseInt(process.env.BROWSER_MAX_RUNTIME_MS ?? `${DEFAULT_MAX_RUNTIME_MS}`, 10);
  const allowedDomains = parseAllowedDomains(process.env.TARGET_URL_ALLOWED_DOMAINS);
  const runDir = path.join(artifactDir, runId);

  const timeoutHandle = setTimeout(() => {
    console.error(`Browser worker exceeded max runtime of ${maxRuntimeMs}ms`);
    process.exit(1);
  }, maxRuntimeMs);

  try {
    await executeRun({
      runId,
      targetUrl,
      runDir,
      loginEmail,
      loginPassword,
      gotoTimeoutMs,
      allowedDomains
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function executeRun({
  runId,
  targetUrl,
  runDir,
  loginEmail,
  loginPassword,
  gotoTimeoutMs,
  allowedDomains
}: {
  runId: string;
  targetUrl: string;
  runDir: string;
  loginEmail?: string;
  loginPassword?: string;
  gotoTimeoutMs: number;
  allowedDomains: string[];
}) {
  await mkdir(runDir, { recursive: true });
  await assertSafeTarget(targetUrl, allowedDomains);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

    const consoleMessages: string[] = [];
    const failedRequests: string[] = [];
    const responses: Array<{ url: string; status: number; method: string }> = [];
    const actions: string[] = [];

    page.on("console", (message) => {
      consoleMessages.push(`[${message.type()}] ${message.text()}`);
    });

    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        responses.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: gotoTimeoutMs });
    actions.push(`navigate:${targetUrl}`);

    if (loginEmail && loginPassword) {
      const loggedIn = await tryLogin(page, loginEmail, loginPassword, actions);
      actions.push(loggedIn ? "login:success" : "login:skipped_or_failed");
    }

    await page.screenshot({ path: path.join(runDir, "page.png"), fullPage: true });

    const accessibility = await new AxeBuilder({ page }).analyze();
    const title = await page.title();
    const interactiveElements = await page
      .locator("a, button, input, select, textarea")
      .evaluateAll((elements) =>
        elements.slice(0, 30).map((element) => {
          const htmlElement = element as HTMLElement;
          return {
            tag: htmlElement.tagName.toLowerCase(),
            text: htmlElement.innerText?.trim().slice(0, 120) ?? "",
            ariaLabel: htmlElement.getAttribute("aria-label"),
            name: htmlElement.getAttribute("name"),
            type: htmlElement.getAttribute("type")
          };
        }),
      );

    await writeFile(
      path.join(runDir, "evidence.json"),
      JSON.stringify(
        {
          runId,
          targetUrl,
          finalUrl: page.url(),
          title,
          actions,
          consoleMessages,
          failedRequests,
          errorResponses: responses,
          interactiveElements,
          axeViolations: accessibility.violations
        },
        null,
        2,
      ),
    );

    console.log(`Saved evidence to ${runDir}`);
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function assertSafeTarget(targetUrl: string, allowedDomains: string[]) {
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported target URL protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked target hostname: ${hostname}`);
  }

  if (allowedDomains.length > 0 && !allowedDomains.some((domain) => matchesAllowedDomain(hostname, domain))) {
    throw new Error(`Target hostname is not in TARGET_URL_ALLOWED_DOMAINS: ${hostname}`);
  }

  const addresses = await resolveHostname(hostname);
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new Error(`Blocked target address resolved for ${hostname}: ${address}`);
    }
  }
}

function parseAllowedDomains(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAllowedDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

async function resolveHostname(hostname: string) {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve target hostname: ${hostname}`);
  }

  return results.map((result) => result.address);
}

function isBlockedHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

function isBlockedAddress(address: string) {
  if (net.isIPv4(address)) {
    const [a, b, c, d] = address.split(".").map(Number);
    return (
      a === 127 ||
      (a === 10) ||
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

async function tryLogin(page: Page, email: string, password: string, actions: string[]) {
  const emailLocator = await firstVisible(page, [
    page.getByLabel(/email/i),
    page.getByPlaceholder(/email/i),
    page.locator('input[type="email"]'),
    page.locator('input[name*="email" i]')
  ]);

  const passwordLocator = await firstVisible(page, [
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.locator('input[type="password"]'),
    page.locator('input[name*="password" i]')
  ]);

  if (!emailLocator || !passwordLocator) {
    return false;
  }

  await emailLocator.fill(email);
  actions.push("type:email");
  await passwordLocator.fill(password);
  actions.push("type:password");

  const submitLocator = await firstVisible(page, [
    page.getByRole("button", { name: /sign in|log in|login|continue/i }),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]')
  ]);

  if (!submitLocator) {
    return false;
  }

  await Promise.allSettled([
    page.waitForLoadState("networkidle", { timeout: 10_000 }),
    submitLocator.click()
  ]);
  actions.push("click:login_submit");
  return true;
}

async function firstVisible(page: Page, locators: Locator[]) {
  for (const locator of locators) {
    const count = await locator.count();
    if (count === 0) continue;
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      return first;
    }
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
