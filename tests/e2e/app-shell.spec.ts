/**
 * App Shell E2E Tests
 *
 * Validates the application shell rendering and basic UI structure
 * against the real Tauri release binary via CDP.
 */
import { test, expect, createNewA2l } from "./fixtures";

test.describe("App Shell", () => {
  test("should load the application and show sidebar", async ({ appPage: page }) => {
    // Verify the Explorer heading is visible
    await expect(page.getByTestId("sidebar-explorer")).toBeVisible();
    await expect(page.getByTestId("sidebar-elf")).toBeVisible();
    await expect(page.getByTestId("sidebar-settings")).toBeVisible();
  });

  test("should show explorer view by default", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-explorer").click();
    await expect(page.getByTestId("heading-explorer")).toBeVisible();
    await expect(page.getByTestId("btn-new-a2l")).toBeVisible();
    await expect(page.getByTestId("btn-open-a2l")).toBeVisible();
  });

  test("should switch to ELF inspector view", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-elf").click();
    await expect(page.getByTestId("heading-elf-inspector")).toBeVisible();
    await expect(page.getByTestId("btn-load-elf")).toBeVisible();
  });

  test("should switch to settings view", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-settings").click();
    await expect(page.getByTestId("heading-settings")).toBeVisible();
  });

  test("layout stays within viewport", async ({ appPage: page }) => {
    const body = page.locator("body");
    const bbox = await body.boundingBox();
    const vp = page.viewportSize();
    if (bbox && vp) {
      expect(bbox.width).toBeLessThanOrEqual(vp.width + 1);
    }
  });
});
