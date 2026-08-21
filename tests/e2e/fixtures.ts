/**
 * Shared Playwright fixtures for all E2E tests.
 * Spawns the real Tauri release binary with CDP and provides
 * an `appPage` connected to the WebView2 window, plus helpers
 * for loading A2L/ELF files without native file dialogs.
 *
 * The frontend exposes window.__E2E__ hooks so tests can call
 * handleLoadA2lFromPath / handleLoadElfFromPath directly,
 * keeping React state in sync with the backend.
 */
import { test as base, type Page, type BrowserContext, type Browser, chromium } from "@playwright/test";
import { spawn, execSync, type ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDP_PORT = 9222;
const BINARY_PATH = path.resolve(
  __dirname,
  "../../src-tauri/target/release/opent_a2l_forge.exe"
);

/** Absolute paths to fixture files */
export const FIXTURES = {
  a2l: {
    software_b: path.resolve(__dirname, "../../external/a2ltool/fixtures/a2l/software_b.a2l"),
    sample: path.resolve(__dirname, "../../external/a2ltool/fixtures/a2l/sample.a2l"),
    from_source: path.resolve(__dirname, "../../external/a2ltool/fixtures/a2l/from_source.a2l"),
    from_source_structs: path.resolve(__dirname, "../../external/a2ltool/fixtures/a2l/from_source_structs.a2l"),
  },
  elf: {
    debugdata_gcc: path.resolve(__dirname, "../../external/a2ltool/fixtures/bin/debugdata_gcc.elf"),
    update_test: path.resolve(__dirname, "../../external/a2ltool/fixtures/bin/update_test.elf"),
    update_typedef_test: path.resolve(__dirname, "../../external/a2ltool/fixtures/bin/update_typedef_test.elf"),
    software_b: path.resolve(__dirname, "../../external/a2ltool/fixtures/bin/software_b.elf"),
    software_a: path.resolve(__dirname, "../../external/a2ltool/fixtures/bin/software_a.elf"),
  },
};

// ── CDP helpers ──────────────────────────────────────────────────────────────

function isCdpAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
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

// ── Test Helpers ─────────────────────────────────────────────────────────────

/**
 * Load an A2L file via the frontend's __E2E__ hook.
 * This calls the real backend AND updates React state properly.
 */
export async function openA2lFile(page: Page, filePath: string): Promise<void> {
  const normalized = filePath.replace(/\//g, "\\");
  await page.evaluate(
    (p: string) => (window as any).__E2E__.loadA2lFromPath(p),
    normalized
  );
}

/**
 * Load an ELF file via the frontend's __E2E__ hook.
 * This calls the real backend AND updates React state (symbols, etc).
 */
export async function openElfFile(page: Page, filePath: string): Promise<void> {
  const normalized = filePath.replace(/\//g, "\\");
  await page.evaluate(
    (p: string) => (window as any).__E2E__.loadElfFromPath(p),
    normalized
  );
}

export async function openCliProject(page: Page, filePath: string): Promise<void> {
  const normalized = filePath.replace(/\//g, "\\");
  await page.evaluate(
    (p: string) => (window as any).__E2E__.loadCliProjectFromPath(p),
    normalized
  );
}

export async function saveCliProject(page: Page, filePath: string): Promise<void> {
  const normalized = filePath.replace(/\//g, "\\");
  await page.evaluate(
    (p: string) => (window as any).__E2E__.saveCliProjectToPath(p),
    normalized
  );
}

/** Create a new empty A2L via the UI button (no dialog needed) */
export async function createNewA2l(page: Page): Promise<void> {
  // Clicking the already-active activity-bar view toggles the sidebar,
  // so only switch to the explorer if it is not visible yet.
  const newBtn = page.getByTestId("btn-new-a2l");
  if (!(await newBtn.isVisible().catch(() => false))) {
    await page.getByTestId("sidebar-explorer").click();
  }
  await newBtn.click();
  await page.getByTestId("entity-tree").waitFor({ timeout: 10000 });
}

/** Call a Tauri IPC command directly (low-level, does NOT update React state) */
export async function tauriInvoke<T>(page: Page, cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(
    ({ cmd, args }) => (window as any).__TAURI_INTERNALS__.invoke(cmd, args),
    { cmd, args }
  );
}

// ── Playwright fixtures ──────────────────────────────────────────────────────

type WorkerFixtures = {
  binaryBrowser: Browser;
};

export const test = base.extend<{ appPage: Page }, WorkerFixtures>({
  binaryBrowser: [async ({}, use) => {
    if (!fs.existsSync(BINARY_PATH)) {
      throw new Error(
        `Release binary not found at ${BINARY_PATH}.\nRun 'npm run tauri build' first.`
      );
    }

    const alreadyRunning = await isCdpAlive(CDP_PORT);
    let child: ChildProcess | null = null;

    if (!alreadyRunning) {
      console.log(`[fixture] Launching ${BINARY_PATH} with CDP on port ${CDP_PORT}`);
      child = spawn(BINARY_PATH, [], {
        env: {
          ...process.env,
          WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
        },
        stdio: "pipe",
      });
      child.stdout?.on("data", (d: Buffer) => console.log(`[binary] ${d.toString().trim()}`));
      child.stderr?.on("data", (d: Buffer) => console.error(`[binary] ${d.toString().trim()}`));
      await waitForCDP(CDP_PORT);
      console.log("[fixture] CDP ready");
    } else {
      console.log("[fixture] Reusing existing binary on CDP port " + CDP_PORT);
    }

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    await use(browser);

    await browser.close().catch(() => {});
    if (child && !child.killed) {
      child.kill();
      try { execSync("taskkill /F /IM opent_a2l_forge.exe", { stdio: "ignore" }); } catch {}
    }
  }, { scope: "worker" }],

  appPage: async ({ binaryBrowser }, use) => {
    const context: BrowserContext | undefined = binaryBrowser.contexts()[0];
    if (!context) throw new Error("No browser context — is the Tauri window open?");

    const page: Page | undefined = context.pages()[0];
    if (!page) throw new Error("No page found — is the Tauri window open?");

    await page.waitForSelector("#root", { timeout: 15000 });
    await use(page);
  },
});

export { expect } from "@playwright/test";
