import { test, expect, FIXTURES, createNewA2l, openElfFile } from "./fixtures";

test.describe("ELF to A2L Integration", () => {
  test("load A2L and ELF, then add symbols to project", async ({ appPage: page }) => {
    // 1. Create new A2L project
    await createNewA2l(page);

    // 2. Switch to ELF view and load ELF
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });

    // 3. Select all symbols via clicking the header checkbox
    await page.getByTestId("checkbox-select-all").click();
    // Wait for selection state to propagate
    await expect(page.getByText(/\d+ Selected/)).toBeVisible({ timeout: 5000 });

    // 4. Click Add to Project
    await page.getByTestId("btn-add-to-a2l").click();

    // 5. Preview dialog should appear
    await expect(page.getByText(/Import Preview/)).toBeVisible({ timeout: 10000 });

    // 6. Click Continue to Import
    await page.getByRole("button", { name: /Continue/i }).click();

    // 7. Preview dialog should close after import
    await expect(page.getByText(/Import Preview/)).not.toBeVisible({ timeout: 15000 });

    // 8. Switch to explorer and verify entity tree has items
    await page.getByTestId("sidebar-explorer").click();
    await expect(page.getByTestId("entity-tree")).toBeVisible();
  });

  test("view switching between explorer and ELF works", async ({ appPage: page }) => {
    // Switch between views multiple times
    await page.getByTestId("sidebar-explorer").click();
    await expect(page.getByTestId("heading-explorer")).toBeVisible();

    await page.getByTestId("sidebar-elf").click();
    await expect(page.getByTestId("heading-elf-inspector")).toBeVisible();

    await page.getByTestId("sidebar-explorer").click();
    await expect(page.getByTestId("heading-explorer")).toBeVisible();
  });
});
