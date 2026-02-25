/**
 * Window Controls E2E Tests
 *
 * Validates that the custom titlebar window control buttons
 * (minimize, maximize, close) are present and the titlebar
 * displays the application name.
 */
import { test, expect } from "./fixtures";

test.describe("Window Controls", () => {
  test("window control buttons are present", async ({ appPage: page }) => {
    await expect(page.getByTestId("btn-minimize")).toBeVisible();
    await expect(page.getByTestId("btn-maximize")).toBeVisible();
    await expect(page.getByTestId("btn-close")).toBeVisible();
  });

  test("titlebar displays application name", async ({ appPage: page }) => {
    await expect(page.getByText("OpenT A2L Forge")).toBeVisible();
  });
});
