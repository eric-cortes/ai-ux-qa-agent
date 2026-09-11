import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type Locator, type Page } from "playwright";

import { assertSafeTarget, parseAllowedDomains } from "./ssrf";

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
    const guidelineChecks = await collectGuidelineChecks(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(runDir, "mobile.png"), fullPage: true });
    guidelineChecks.viewport = await collectViewportEvidence(page);
    await page.setViewportSize({ width: 1440, height: 960 });

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
          axeViolations: accessibility.violations,
          guidelineChecks
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


type GuidelineChecks = {
  unlabeledFormControls: Array<{ tag: string; type: string | null; name: string | null }>;
  smallTargets: Array<{ tag: string; text: string; width: number; height: number }>;
  keyboard: { sampledTabStops: string[]; focusLostToDocument: boolean };
  viewport?: { width: number; scrollWidth: number; hasHorizontalOverflow: boolean };
};

async function collectGuidelineChecks(page: Page): Promise<GuidelineChecks> {
  const structuralChecks = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const unlabeledFormControls = Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((element) => {
        const input = element as HTMLInputElement;
        return isVisible(element) && !["hidden", "submit", "button", "reset", "image"].includes(input.type) &&
          !input.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby");
      })
      .slice(0, 30)
      .map((element) => ({ tag: element.tagName.toLowerCase(), type: element.getAttribute("type"), name: element.getAttribute("name") }));
    const smallTargets = Array.from(document.querySelectorAll("a, button, input, select, textarea, [role='button'], [role='link']"))
      .filter(isVisible)
      .map((element) => ({ element, rect: element.getBoundingClientRect(), display: window.getComputedStyle(element).display }))
      .filter(({ element, rect, display }) => !(element.tagName === "A" && display === "inline") && (rect.width < 24 || rect.height < 24))
      .slice(0, 30)
      .map(({ element, rect }) => ({ tag: element.tagName.toLowerCase(), text: (element.textContent ?? "").trim().slice(0, 120), width: Math.round(rect.width), height: Math.round(rect.height) }));
    return { unlabeledFormControls, smallTargets };
  });

  const sampledTabStops: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    sampledTabStops.push(await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return element ? `${element.tagName.toLowerCase()}#${element.id}.${element.getAttribute("role") ?? ""}` : "none";
    }));
  }
  const focusLostToDocument = sampledTabStops.includes("body#.");
  return { ...structuralChecks, keyboard: { sampledTabStops, focusLostToDocument } };
}

async function collectViewportEvidence(page: Page) {
  return page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));
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
