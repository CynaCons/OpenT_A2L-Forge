import path from "node:path";
import { test, expect } from "@playwright/test";

// This test requires the Tauri backend to be running to handle 'invoke' calls.
// Currently, 'npm run e2e' only starts the Vite dev server (frontend only).
// Enable this test once E2E environment supports backend or when testing against a built app.
test.fixme("edit core entities (Measurement, Characteristic, AxisPts)", async ({ page }) => {
  await page.goto("/");
  
  // Load A2L with entities
  const fixturePath = path.resolve("tests/fixtures/a2l/e2e_editing.a2l");
  await page.setInputFiles("input[type=\"file\"]", fixturePath);
  await expect(page.getByText("A2L loaded and parsed.")).toBeVisible();

  // --- Measurement Editing ---
  // Expand Measurements
  await page.getByRole('treeitem', { name: "Measurements" }).click();
  // Click EngineSpeed
  await page.getByText("EngineSpeed").click();
  await expect(page.getByText("Engine Speed", { exact: false })).toBeVisible(); // Check description
  
  // Click Edit
  await page.getByRole("button", { name: "Edit" }).click();
  
  // Edit Upper Limit
  await page.getByLabel("Upper Limit").fill("12000");
  await page.getByRole("button", { name: "Save" }).click();
  
  // Check if save persisted in UI (Limits: 0 .. 12000)
  await expect(page.getByText("Limits")).toBeVisible();
  await expect(page.getByText("0 .. 12000")).toBeVisible();

  // --- Characteristic Editing ---
  // Expand Characteristics
  await page.getByRole('treeitem', { name: "Characteristics" }).click();
  await page.getByText("MaxRPM").click();
  
  // Edit
  await page.getByRole("button", { name: "Edit" }).click();
  // Change Address
  await page.getByLabel("Address (Hex)").fill("2020");
  await page.getByRole("button", { name: "Save" }).click();
  
  // Verify Address changed
  await expect(page.getByText("Address")).toBeVisible();
  await expect(page.getByText("0x2020")).toBeVisible();

  // --- AxisPts Editing ---
  // Expand Axis Points
  await page.getByRole('treeitem', { name: "Axis Points" }).click();
  await page.getByText("RPM_Axis").click();

  // Edit
  await page.getByRole("button", { name: "Edit" }).click();
  // Change Max Axis Points
  await page.getByLabel("Max Axis Points").fill("16");
  await page.getByLabel("Input Quantity").fill("EngineSpeed_New");
  await page.getByRole("button", { name: "Save" }).click();

  // Verify
  // "Input quantity" detail should be updated
  await expect(page.getByText("Input quantity")).toBeVisible();
  await expect(page.getByText("EngineSpeed_New")).toBeVisible();
  await expect(page.getByText("Max axis points")).toBeVisible();
  await expect(page.getByText("16")).toBeVisible();
});
