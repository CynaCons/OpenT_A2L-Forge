import { test, expect } from "@playwright/test";

test("layout stays within viewport", async ({ page }) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalOverflow).toBeFalsy();

  await expect(page.getByRole("button", { name: "A2L" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ELF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});
