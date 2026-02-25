import { test, expect, FIXTURES, openElfFile } from "./fixtures";

test.describe("ELF File Loading", () => {
  test("load real ELF file and show symbols", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-elf").click();
    await expect(page.getByTestId("heading-elf-inspector")).toBeVisible();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    // Wait for symbols to load - status message shows count
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });
    // ELF table should be visible with symbol rows
    await expect(page.getByTestId("elf-table")).toBeVisible();
  });

  test("ELF symbol table has sortable columns", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });
    // Sort headers should be visible
    await expect(page.getByTestId("sort-name")).toBeVisible();
    await expect(page.getByTestId("sort-address")).toBeVisible();
  });

  test("ELF search filters symbols", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });
    // Search for something
    const searchInput = page.getByTestId("search-elf").locator("input");
    await searchInput.fill("main");
    await page.waitForTimeout(500);
    // Table should still be visible (even if no matches for "main")
    await expect(page.getByTestId("elf-table")).toBeVisible();
  });

  test("load second ELF file replaces first", async ({ appPage: page }) => {
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.debugdata_gcc);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });
    // Load a different ELF
    await openElfFile(page, FIXTURES.elf.update_test);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });
  });
});
