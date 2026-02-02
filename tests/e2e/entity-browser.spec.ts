import path from "node:path";
import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./mocks";

test.beforeEach(async ({ page }) => {
  await setupTauriMocks(page);
});

test("entity list appears in cards", async ({ page }) => {
  await page.goto("/");

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("Loaded successfully.")).toBeVisible();

  await expect(page.getByText("EXPLORER")).toBeVisible();
  await expect(page.getByText("demo_module")).toBeVisible();
});
