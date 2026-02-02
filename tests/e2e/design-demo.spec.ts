import path from "node:path";
import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./mocks";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
});

test("design demo walkthrough", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("EXPLORER")).toBeVisible();

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("Loaded successfully.")).toBeVisible();
  await expect(page.getByText("sample.a2l")).toBeVisible();
  await expect(page.getByText("demo_module")).toBeVisible();
  await expect(page.getByText("Measurements")).toBeVisible();

  await page.getByLabel("ELF Symbols").click();
  await expect(page.getByText("ELF INSPECTOR")).toBeVisible();

  await page.getByLabel("Settings").click();
  await expect(page.getByText("SETTINGS", { exact: true })).toBeVisible();
});
