/**
 * Screenshot capture for README documentation.
 * Run with: npx playwright test take-screenshots
 */
import { test, expect, openA2lFile, openElfFile, createNewA2l, FIXTURES } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("Screenshots", () => {
  const screenshotDir = "docs/screenshots";

  test("A2L entity browser view", async ({ appPage: page }) => {
    await openA2lFile(page, FIXTURES.a2l.from_source);
    await page.waitForTimeout(1000);

    // Expand first section to show entities
    const tree = page.getByTestId("entity-tree");
    await tree.waitFor({ timeout: 10000 });

    // Click on first measurement to show detail
    const firstItem = tree.locator(".MuiTreeItem-content").nth(3);
    await firstItem.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${screenshotDir}/a2l-view.png`,
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });
  });

  test("ELF symbol inspector view", async ({ appPage: page }) => {
    await openA2lFile(page, FIXTURES.a2l.from_source);
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await page.waitForTimeout(500);

    // Switch to ELF view
    await page.getByTestId("sidebar-elf").click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${screenshotDir}/elf-view.png`,
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });
  });

  test("ELF-to-A2L import view", async ({ appPage: page }) => {
    await openA2lFile(page, FIXTURES.a2l.from_source);
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await page.waitForTimeout(500);

    // Switch to ELF view and select some symbols
    await page.getByTestId("sidebar-elf").click();
    await page.waitForTimeout(500);

    // Select all
    await page.getByTestId("checkbox-select-all").click();
    await page.waitForTimeout(300);

    // Click Add to A2L
    await page.getByTestId("btn-add-to-a2l").click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${screenshotDir}/import-view.png`,
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });
  });

  test("Create entity dialog", async ({ appPage: page }) => {
    await createNewA2l(page);
    await page.waitForTimeout(500);

    // Click the Create Entity button
    await page.getByTestId("btn-create-entity").click();
    await page.waitForTimeout(500);

    // Fill in some fields for visual appeal
    const nameField = page.getByTestId("create-entity-name").locator("input");
    await nameField.fill("EngineSpeed_RPM");

    await page.waitForTimeout(300);

    await page.screenshot({
      path: `${screenshotDir}/create-entity.png`,
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });

    // Close dialog
    const dialog = page.getByTestId("create-entity-dialog");
    await dialog.press("Escape");
  });
});
