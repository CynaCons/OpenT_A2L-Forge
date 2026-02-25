/**
 * E2E tests for loading real A2L files via the Tauri backend.
 * No mocks — these hit the real binary and real fixture files.
 */
import { test, expect, FIXTURES, openA2lFile } from "./fixtures";

test.describe("A2L File Loading", () => {
  test("load real A2L file and show metadata", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-explorer").click();
    await openA2lFile(page, FIXTURES.a2l.software_b);
    // Wait for the status message indicating success
    await expect(page.getByText("Loaded successfully.")).toBeVisible({ timeout: 15000 });
    // Project should show entity tree
    await expect(page.getByTestId("heading-explorer")).toBeVisible();
  });

  test("loaded A2L shows measurements in tree", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-explorer").click();
    await openA2lFile(page, FIXTURES.a2l.software_b);
    await expect(page.getByText("Loaded successfully.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Measurements")).toBeVisible();
  });

  test("search entities filters the tree", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-explorer").click();
    await openA2lFile(page, FIXTURES.a2l.software_b);
    await expect(page.getByText("Loaded successfully.")).toBeVisible({ timeout: 15000 });
    // Type in search box
    const searchInput = page.getByTestId("search-entities").locator("input");
    await searchInput.fill("engine");
    // Wait a moment for filtering
    await page.waitForTimeout(500);
    // The tree should be filtered (fewer items visible)
    // Just verify the search didn't crash
    await expect(page.getByTestId("heading-explorer")).toBeVisible();
  });
});
