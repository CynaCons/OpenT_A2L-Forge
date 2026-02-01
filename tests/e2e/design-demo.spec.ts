import path from "node:path";
import { test, expect } from "@playwright/test";

test("design demo walkthrough", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("A2L Workspace")).toBeVisible();

  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);

  await expect(page.getByText("A2L loaded and parsed.")).toBeVisible();
  await expect(page.getByText("sample.a2l")).toBeVisible();
  await expect(page.getByText("Project")).toBeVisible();
  await expect(page.getByText("A2L Contents")).toBeVisible();

  await page.getByRole("button", { name: "ELF" }).click();
  await expect(page.getByText("ELF Workspace")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Settings")).toBeVisible();
});
