import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Locator, type Page } from "playwright";

async function main() {
  const targetUrl = process.env.TARGET_URL ?? "https://example.com";
  const artifactDir = process.env.ARTIFACT_LOCAL_DIR ?? "./storage/artifacts";
  const runId = process.env.RUN_ID ?? `run_${Date.now()}`;
  const loginEmail = process.env.TARGET_APP_LOGIN_EMAIL;
  const loginPassword = process.env.TARGET_APP_LOGIN_PASSWORD;
  const runDir = path.join(artifactDir, runId);

  await mkdir(runDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

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

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  actions.push(`navigate:${targetUrl}`);

  if (loginEmail && loginPassword) {
    const loggedIn = await tryLogin(page, loginEmail, loginPassword, actions);
    actions.push(loggedIn ? "login:success" : "login:skipped_or_failed" );
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

  await browser.close();
  console.log(`Saved evidence to ${runDir}`);
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
