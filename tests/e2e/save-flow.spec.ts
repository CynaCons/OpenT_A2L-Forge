/**
 * E2E tests for save functionality using the real Tauri backend.
 * No mocks — these use real A2L files and the actual binary.
 */
import { test, expect, FIXTURES, openA2lFile } from "./fixtures";

test.describe("Save Flow", () => {
  test("save button is visible after loading A2L", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-explorer").click();
    await openA2lFile(page, FIXTURES.a2l.software_b);
    await expect(page.getByText("Loaded successfully.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("btn-save-a2l")).toBeVisible();
  });
});
