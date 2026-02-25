/**
 * Capture README screenshots at 1920x1080 using the real release binary.
 *
 * Usage: npx playwright test scripts/take-screenshots.ts --project=binary
 *   or:  npx tsx scripts/take-screenshots.ts
 */
import { chromium, type Page } from "@playwright/test";
import { spawn, execSync, type ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDP_PORT = 9222;
const BINARY_PATH = path.resolve(__dirname, "../src-tauri/target/release/opent_a2l_forge.exe");
const SCREENSHOT_DIR = path.resolve(__dirname, "../docs/screenshots");
const WIDTH = 1920;
const HEIGHT = 1080;

const FIXTURES = {
  a2l: path.resolve(__dirname, "../external/a2ltool/fixtures/a2l/software_b.a2l"),
  elf: path.resolve(__dirname, "../external/a2ltool/fixtures/bin/debugdata_gcc.elf"),
};

function isCdpAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve(true));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForCDP(port: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isCdpAlive(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`CDP not ready on port ${port} after ${timeoutMs}ms`);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(BINARY_PATH)) {
    throw new Error(`Release binary not found at ${BINARY_PATH}.\nRun 'npm run tauri build' first.`);
  }
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Launch binary
  const alreadyRunning = await isCdpAlive(CDP_PORT);
  let child: ChildProcess | null = null;

  if (!alreadyRunning) {
    console.log(`Launching ${BINARY_PATH}...`);
    child = spawn(BINARY_PATH, [], {
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
      },
      stdio: "pipe",
    });
    await waitForCDP(CDP_PORT);
    console.log("CDP ready");
  } else {
    console.log("Reusing existing binary on CDP port " + CDP_PORT);
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No browser context");
  const page = context.pages()[0];
  if (!page) throw new Error("No page");

  await page.waitForSelector("#root", { timeout: 15000 });

  // Set viewport to 1920x1080
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await sleep(500);

  // ── Screenshot 1: A2L Entity Browser & Editor ──
  console.log("Taking a2l-view screenshot...");
  const a2lPath = FIXTURES.a2l.replace(/\//g, "\\");
  await page.evaluate((p: string) => (window as any).__E2E__.loadA2lFromPath(p), a2lPath);
  await page.getByTestId("entity-tree").waitFor({ timeout: 10000 });
  await sleep(1000);

  // Expand a tree section and click an entity to show the detail view
  // Click on Measurement section to expand it
  const measurementSection = page.getByText("Measurement").first();
  await measurementSection.click();
  await sleep(500);

  // Click first entity in the tree to show detail
  const treeItems = page.locator('[data-testid="entity-tree"] [role="button"]');
  const count = await treeItems.count();
  if (count > 1) {
    await treeItems.nth(1).click();
    await sleep(500);
  }

  // Wait for detail view
  await page.getByTestId("entity-detail").waitFor({ timeout: 5000 }).catch(() => {});
  await sleep(500);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "a2l-view.png") });
  console.log("  -> a2l-view.png saved");

  // ── Screenshot 2: ELF Symbol Inspector ──
  console.log("Taking elf-view screenshot...");
  // Switch to ELF view
  await page.getByTestId("sidebar-elf").click();
  await sleep(500);

  const elfPath = FIXTURES.elf.replace(/\//g, "\\");
  await page.evaluate((p: string) => (window as any).__E2E__.loadElfFromPath(p), elfPath);
  await sleep(2000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "elf-view.png") });
  console.log("  -> elf-view.png saved");

  // ── Screenshot 3: ELF-to-A2L Import ──
  console.log("Taking import-view screenshot...");
  // Select some symbols using the select-all checkbox
  await page.getByTestId("checkbox-select-all").click();
  await sleep(500);

  // Click "Add to Project" button to open import/preview dialog
  const addBtn = page.getByTestId("btn-add-to-a2l");
  if (await addBtn.isEnabled()) {
    await addBtn.click();
    await sleep(1500);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "import-view.png") });
  console.log("  -> import-view.png saved");

  // Cleanup
  await browser.close().catch(() => {});
  if (child && !child.killed) {
    child.kill();
    try { execSync("taskkill /F /IM opent_a2l_forge.exe", { stdio: "ignore" }); } catch {}
  }

  console.log("\nAll screenshots saved to docs/screenshots/");
}

main().catch((e) => {
  console.error(e);
  try { execSync("taskkill /F /IM opent_a2l_forge.exe", { stdio: "ignore" }); } catch {}
  process.exit(1);
});
