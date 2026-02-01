import path from "node:path";
import { test, expect } from "@playwright/test";

test("load A2L and show content cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("A2L Workspace")).toBeVisible();

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("A2L loaded and parsed.")).toBeVisible();
  await expect(page.getByText("demo_project")).toBeVisible();
  await expect(page.getByText("A2L Contents")).toBeVisible();
  await expect(page.getByText("Project")).toBeVisible();
  await expect(page.getByText("sample.a2l")).toBeVisible();
});
