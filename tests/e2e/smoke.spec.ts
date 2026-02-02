import path from "node:path";
import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./mocks";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
});

test("load A2L and show content cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("EXPLORER")).toBeVisible();

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("Loaded successfully.")).toBeVisible();
  await expect(page.getByText("demo_module")).toBeVisible();
  
  // Verify tree structure bits
  await expect(page.getByText("Measurements")).toBeVisible();
  await expect(page.getByText("Characteristics")).toBeVisible();
});
