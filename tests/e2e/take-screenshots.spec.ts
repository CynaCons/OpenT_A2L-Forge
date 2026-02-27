/**
 * Screenshot capture for README documentation.
 * Run with: npx playwright test take-screenshots
 *
 * IMPORTANT: Screenshots must be 1920x1080 resolution minimum.
 * We use CDP protocol to resize the browser window before capturing.
 */
import { test, expect, openA2lFile, openElfFile, createNewA2l, FIXTURES } from "./fixtures";
import type { Page } from "@playwright/test";

const SCREENSHOT_DIR = "docs/screenshots";
const WIDTH = 1920;
const HEIGHT = 1080;

/** Resize the window to 1920x1080 via CDP and Tauri toggle-maximize */
async function setupHighResViewport(page: Page) {
  // First try to use Tauri's toggle-maximize (allowed by ACL)
  try {
    await page.evaluate(async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isMax = await win.isMaximized();
      if (!isMax) await win.toggleMaximize();
    });
    await page.waitForTimeout(500);
  } catch {
    // Fallback: just set viewport size
  }

  // Set viewport to 1920x1080 for consistent screenshots
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.waitForTimeout(300);
}

test.describe("Screenshots", () => {
  test("01 - A2L entity browser view", async ({ appPage: page }) => {
    await setupHighResViewport(page);

    await openA2lFile(page, FIXTURES.a2l.from_source);
    await page.waitForTimeout(1000);

    // Expand the entity tree
    const tree = page.getByTestId("entity-tree");
    await tree.waitFor({ timeout: 10000 });

    // Expand Measurements section
    const measurementsSection = tree.getByText("Measurements");
    await measurementsSection.click();
    await page.waitForTimeout(300);

    // Click on a measurement entity to show its detail
    const entityItems = tree.locator(".MuiTreeItem-content");
    const items = await entityItems.all();
    for (const item of items) {
      const text = await item.textContent();
      if (text && text.includes("shapes_a2l")) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/a2l-view.png`,
    });
  });

  test("02 - ELF symbol inspector view", async ({ appPage: page }) => {
    await setupHighResViewport(page);

    await openA2lFile(page, FIXTURES.a2l.from_source);
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await page.waitForTimeout(500);

    // Switch to ELF view
    await page.getByTestId("sidebar-elf").click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/elf-view.png`,
    });
  });

  test("03 - ELF-to-A2L import preview", async ({ appPage: page }) => {
    await setupHighResViewport(page);

    await openA2lFile(page, FIXTURES.a2l.from_source);
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await page.waitForTimeout(500);

    // Switch to ELF view and select symbols
    await page.getByTestId("sidebar-elf").click();
    await page.waitForTimeout(500);

    // Select all symbols
    await page.getByTestId("checkbox-select-all").click();
    await page.waitForTimeout(300);

    // Click Add to A2L to open preview dialog
    await page.getByTestId("btn-add-to-a2l").click();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/import-view.png`,
    });
  });

  test("04 - Create Measurement dialog", async ({ appPage: page }) => {
    await setupHighResViewport(page);

    await createNewA2l(page);
    await page.waitForTimeout(500);

    // Open Create Entity dialog
    await page.getByTestId("btn-create-entity").click();
    await page.waitForTimeout(500);

    // Fill in realistic Measurement fields
    const nameField = page.getByTestId("create-entity-name").locator("input");
    await nameField.fill("EngineSpeed_RPM");

    // Find and fill the Long Identifier field
    const textareas = page.locator("textarea");
    const allTextareas = await textareas.all();
    for (const ta of allTextareas) {
      const label = await ta.evaluate((el) => {
        const container = el.closest(".MuiFormControl-root");
        const labelEl = container?.querySelector("label");
        return labelEl?.textContent || "";
      });
      if (label.includes("Long Identifier")) {
        await ta.fill("Engine speed measurement in RPM from crankshaft sensor");
        break;
      }
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/create-entity.png`,
    });

    // Close dialog
    await page.keyboard.press("Escape");
  });

  test("05 - Entity editing mode", async ({ appPage: page }) => {
    await setupHighResViewport(page);

    await openA2lFile(page, FIXTURES.a2l.from_source);
    await page.waitForTimeout(1000);

    const tree = page.getByTestId("entity-tree");
    await tree.waitFor({ timeout: 10000 });

    // Expand Measurements and click one
    const measurementsSection = tree.getByText("Measurements");
    await measurementsSection.click();
    await page.waitForTimeout(300);

    // Click a measurement entity
    const entityItems = tree.locator(".MuiTreeItem-content");
    const items = await entityItems.all();
    for (const item of items) {
      const text = await item.textContent();
      if (text && text.includes("shapes_a2l")) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(500);

    // Click Edit button to enter edit mode
    const editBtn = page.getByTestId("btn-edit");
    await editBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/edit-entity.png`,
    });
  });
});
