import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const FIXTURES_DIR = path.resolve("external/a2ltool/fixtures/a2l");

function getLargestA2lFixturePath() {
  const entries = fs
    .readdirSync(FIXTURES_DIR)
    .filter((entry) => entry.toLowerCase().endsWith(".a2l"))
    .map((entry) => {
      const fullPath = path.join(FIXTURES_DIR, entry);
      const stats = fs.statSync(fullPath);
      return { entry, fullPath, size: stats.size };
    })
    .sort((a, b) => b.size - a.size);

  if (!entries.length) {
    throw new Error("No A2L fixtures found in external/a2ltool/fixtures/a2l");
  }

  return entries[0];
}

test("load largest A2L fixture without crashing", async ({ page }) => {
  test.setTimeout(120_000);

  const watchdogMs = 120_000;
  let watchdogId: NodeJS.Timeout | null = null;

  const watchdog = new Promise<never>((_, reject) => {
    watchdogId = setTimeout(() => {
      reject(new Error(`Watchdog timeout after ${watchdogMs}ms`));
    }, watchdogMs);
  });

  const run = async () => {
    const largest = getLargestA2lFixturePath();

    await page.goto("/");
    await expect(page.getByText("A2L Workspace")).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept=".a2l"]').first();
    await fileInput.setInputFiles(largest.fullPath);

    await expect(page.getByText("A2L loaded and parsed.")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(largest.entry, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("A2L Contents")).toBeVisible();
  };

  try {
    await Promise.race([run(), watchdog]);
  } finally {
    if (watchdogId) {
      clearTimeout(watchdogId);
    }
  }
});
