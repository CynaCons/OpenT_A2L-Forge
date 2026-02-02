import { test, expect } from "@playwright/test";

test.describe("App Sanity Check", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL
    await page.goto("/");
  });

  test("should load the application shell", async ({ page }) => {
    // Check for the Window Title / Header
    // Note: The custom title bar text "OpenT A2L Forge"
    await expect(page.getByText("OpenT A2L Forge").first()).toBeVisible();
    
    // Check for Activity Bar buttons
    await expect(page.getByLabel("Explorer")).toBeVisible();
    await expect(page.getByLabel("ELF Symbols")).toBeVisible();
    await expect(page.getByLabel("Settings")).toBeVisible();
  });

  test("should show the explorer sidebar by default", async ({ page }) => {
    // Check for Sidebar Header
    await expect(page.getByText("EXPLORER")).toBeVisible();
    
    // Check for action buttons in sidebar
    await expect(page.getByLabel("New A2L")).toBeVisible();
    await expect(page.getByLabel("Open A2L")).toBeVisible();
    
    // Check for Search Box
    await expect(page.getByPlaceholder("Search entities...")).toBeVisible();
  });

  test("should show the empty state in main area", async ({ page }) => {
    // Check for the placeholder text in the main area
    await expect(page.getByText("Select a file to begin")).toBeVisible();
  });

  test("should report no console errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
            errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000); // Wait for a bit to catch startup errors
      expect(errors).toEqual([]);
  });
});
