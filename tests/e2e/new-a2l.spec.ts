/**
 * New A2L Creation E2E Tests
 *
 * Validates that creating a new A2L project via the UI button
 * produces the expected project metadata and entity tree.
 */
import { test, expect, createNewA2l } from "./fixtures";

test.describe("New A2L Creation", () => {
  test("create new A2L shows project metadata", async ({ appPage: page }) => {
    await createNewA2l(page);
    // Entity tree should contain the module name
    await expect(page.getByTestId("entity-tree").getByText("new_module")).toBeVisible();
    // Titlebar should contain the project file name
    await expect(page.getByTestId("titlebar-filename")).toBeVisible();
  });

  test("new A2L shows entity tree with module", async ({ appPage: page }) => {
    await createNewA2l(page);
    await expect(page.getByText("new_module")).toBeVisible();
    // Entity tree container should be present
    await expect(page.getByTestId("entity-tree")).toBeVisible();
  });

  test("new A2L shows filename in titlebar", async ({ appPage: page }) => {
    await createNewA2l(page);
    // Titlebar should show the new project filename
    await expect(page.getByTestId("titlebar-filename")).toContainText("new_project");
  });
});
