import { test, expect, FIXTURES, createNewA2l, openElfFile } from "./fixtures";

test.describe("Nested Structure Import", () => {
  test("imports a nested ELF struct leaf into the project", async ({ appPage: page }) => {
    await createNewA2l(page);

    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.update_typedef_test);
    await expect(page.getByText(/Loaded \d+ symbols/)).toBeVisible({ timeout: 15000 });

    const structParent = page.getByTestId("elf-row-struct_b");
    const nestedLeafRow = page.getByTestId("elf-row-struct_b.s1.val_i32");

    await expect(nestedLeafRow).toBeVisible();
    await structParent.click();
    await expect(nestedLeafRow).not.toBeVisible();
    await structParent.click();
    await expect(nestedLeafRow).toBeVisible();

    await nestedLeafRow.click();
    await expect(page.getByText("1 Selected")).toBeVisible();

    await page.getByTestId("btn-add-to-a2l").click();
    await expect(page.getByTestId("dialog-preview")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("dialog-preview")).toContainText("struct_b.s1.val_i32");
    await page.getByRole("button", { name: /Continue to Import/i }).click();
    await expect(page.getByTestId("dialog-preview")).not.toBeVisible({ timeout: 15000 });

    await page.getByTestId("sidebar-explorer").click();

    const tree = page.getByTestId("entity-tree");
    await expect(tree.getByText(/Characteristics \(1\)/)).toBeVisible();
    await tree.getByText(/Characteristics \(1\)/).click();
    await expect(tree.getByText("struct_b.s1.val_i32", { exact: true })).toBeVisible();
    await expect(page.getByTestId("entity-detail")).toContainText("struct_b.s1.val_i32");
  });
});
