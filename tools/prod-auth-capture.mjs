import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const authDir = path.join(rootDir, "test-results", "prod-auth");
const storagePath = path.join(authDir, "storage-state.json");
const capturePath = path.join(authDir, "post-login.png");

fs.mkdirSync(authDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const page = await context.newPage();

page.on("console", (msg) => {
  console.log(`[console:${msg.type()}] ${msg.text()}`);
});

page.on("pageerror", (error) => {
  console.log(`[pageerror] ${error.message}`);
});

await page.goto("https://4stash.com/login", {
  waitUntil: "domcontentloaded",
  timeout: 120_000,
});

const consentButtons = [
  "button.analytics-consent-btn-secondary",
  "button:has-text('No thanks')",
];

for (const selector of consentButtons) {
  const button = page.locator(selector).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click().catch(() => {});
    break;
  }
}

const googleButton = page.locator('button[title="Google"]').first();
await googleButton.waitFor({ state: "visible", timeout: 30_000 });
await googleButton.click();

console.log("Waiting for login completion. Finish the Google sign-in in the opened browser window.");
await page.waitForURL(/https:\/\/4stash\.com\/(dashboard|$)/, {
  timeout: 600_000,
});
await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
await page.screenshot({ path: capturePath, fullPage: true });
await context.storageState({ path: storagePath, indexedDB: true });

console.log(`Captured screenshot: ${capturePath}`);
console.log(`Saved storage state: ${storagePath}`);
console.log(`Final URL: ${page.url()}`);

await page.waitForTimeout(10_000);
await context.close();
await browser.close();
