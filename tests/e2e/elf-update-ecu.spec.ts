import { test, expect, FIXTURES, createNewA2l, openElfFile } from "./fixtures";

test.describe("ECU Address Update", () => {
  test("update ECU addresses button works after loading A2L and ELF", async ({ appPage: page }) => {
    // 1. Create new A2L
    await createNewA2l(page);

    // 2. Load ELF
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });

    // 3. Add some symbols first — click select-all checkbox
    await page.getByTestId("checkbox-select-all").click();
    await expect(page.getByText(/\d+ Selected/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("btn-add-to-a2l").click();
    await expect(page.getByText(/Import Preview/)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Continue/i }).click();
    // Wait for preview dialog to close (import complete)
    await expect(page.getByText(/Import Preview/)).not.toBeVisible({ timeout: 15000 });

    // 4. Click Update ECU Addresses — should not throw
    await page.getByTestId("btn-update-ecu").click();
    // Wait for operation to complete (loading indicator disappears)
    await page.waitForTimeout(1000);
    // Verify button is still enabled (operation completed successfully)
    await expect(page.getByTestId("btn-update-ecu")).toBeEnabled({ timeout: 5000 });
  });
});
