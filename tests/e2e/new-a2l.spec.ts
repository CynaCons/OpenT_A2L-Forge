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
    await expect(page.getByText("new_project")).toBeVisible();
    await expect(page.getByText("new_module")).toBeVisible();
  });

  test("new A2L shows entity tree with module", async ({ appPage: page }) => {
    await createNewA2l(page);
    await expect(page.getByText("new_module")).toBeVisible();
    // Entity tree container should be present
    await expect(page.getByTestId("entity-tree")).toBeVisible();
  });

  test("new A2L shows correct file in status bar", async ({ appPage: page }) => {
    await createNewA2l(page);
    // Status bar should show the new project file name
    await expect(page.getByText("new_project.a2l")).toBeVisible();
  });
});
