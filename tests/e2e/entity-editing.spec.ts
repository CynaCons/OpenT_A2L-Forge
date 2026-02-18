/**
 * E2E tests for entity editing using the real Tauri backend.
 * No mocks — these use real A2L files and the actual binary.
 */
import { test, expect, FIXTURES, openA2lFile } from "./fixtures";

test.describe("Entity Editing", () => {
  test("load A2L and verify entity tree has measurements", async ({ appPage: page }) => {
    // Load a real A2L file that has measurements
    // Make sure explorer view is active
    await page.getByTestId("sidebar-explorer").click();
    await openA2lFile(page, FIXTURES.a2l.software_b);
    // Entity tree should be present after loading
    await expect(page.getByTestId("entity-tree")).toBeVisible({ timeout: 15000 });
    // The module name in software_b.a2l is "YYKZ" — click to expand
    await page.getByTestId("entity-tree").getByText("YYKZ").click();
    await expect(page.getByText(/Measurements/)).toBeVisible({ timeout: 5000 });
  });
});
