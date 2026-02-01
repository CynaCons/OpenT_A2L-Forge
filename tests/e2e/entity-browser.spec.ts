import path from "node:path";
import { test, expect } from "@playwright/test";

test("entity list appears in cards", async ({ page }) => {
  await page.goto("/");

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("A2L loaded and parsed.")).toBeVisible();

  await expect(page.getByText("A2L Contents")).toBeVisible();
  await expect(page.getByText("demo_module")).toBeVisible();
});
