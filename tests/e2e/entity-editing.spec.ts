import { test, expect } from "@playwright/test";
import { setupTauriMock, type MockState } from "./mocks";

test("edit core entities (Measurement, Characteristic, AxisPts)", async ({ page }) => {
  // Setup Mock Backend
  const INITIAL_STATE: MockState = {
      metadata: {
          project_name: "editing_project",
          project_long_identifier: "",
          module_names: ["edit_module"],
          warning_count: 0
      },
      measurements: [
          {
              name: "EngineSpeed",
              long_identifier: "Engine Speed",
              datatype: "UWORD",
              conversion: "Ident",
              resolution: 1,
              accuracy: 0,
              lower_limit: 0,
              upper_limit: 8000,
              ecu_address: "0x1234",
              kind: "Measurement"
          }
      ],
      characteristics: [
          {
              name: "MaxRPM",
              long_identifier: "Max RPM Limit",
              characteristic_type: "VALUE",
              address: "0x2000",
              deposit: "absolute",
              max_diff: 0,
              conversion: "Ident",
              lower_limit: 0,
              upper_limit: 10000,
              kind: "Characteristic"
          }
      ],
      axis_pts: [
          {
              name: "RPM_Axis",
              long_identifier: "RPM Axis Points",
              address: "0x3000",
              input_quantity: "EngineSpeed",
              deposit_record: "absolute",
              max_diff: 0,
              conversion: "Ident",
              max_axis_points: 8,
              lower_limit: 0,
              upper_limit: 8000,
              kind: "AxisPts"
          }
      ]
  };

  // Pass data as argument to setupTauriMock
  await page.addInitScript(setupTauriMock, { initialState: INITIAL_STATE });
  
  await page.goto("/");
  
  // Load A2L
  await page.setInputFiles("input[type=\"file\"]", {
      name: "test.a2l",
      mimeType: "text/plain",
      buffer: Buffer.from("DUMMY")
  });
  
  await expect(page.getByText("Loaded successfully.")).toBeVisible();

  // --- Measurement Editing ---
  await page.getByRole('treeitem', { name: "Measurements" }).click();
  await page.getByRole('treeitem', { name: "EngineSpeed" }).click();
  
  await expect(page.getByRole("heading", { name: "EngineSpeed" })).toBeVisible(); 
  
  // Click Edit
  await page.getByRole("button", { name: "Edit Entity" }).click();
  
  // Edit Upper Limit
  await page.getByLabel("Upper Limit").fill("12000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  // Check if save persisted in UI
  await expect(page.getByText("LIMITS")).toBeVisible(); 
  await expect(page.getByText("0 .. 12000")).toBeVisible();

  // --- Characteristic Editing ---
  await page.getByRole('treeitem', { name: "Characteristics" }).click();
  await page.getByRole('treeitem', { name: "MaxRPM" }).click();
  
  await page.getByRole("button", { name: "Edit Entity" }).click();
  await page.getByLabel("Address").fill("0x2020");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  await expect(page.getByText("ADDRESS")).toBeVisible();
  await expect(page.getByText("0x2020")).toBeVisible();

  // --- AxisPts Editing ---
  await page.getByRole('treeitem', { name: "Axis Points" }).click();
  await page.getByRole('treeitem', { name: "RPM_Axis" }).click();

  await page.getByRole("button", { name: "Edit Entity" }).click();
  await page.getByLabel("Max Axis Points").fill("16");
  await page.getByLabel("Input Quantity").fill("EngineSpeed_New");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  await expect(page.getByText("INPUT QUANTITY")).toBeVisible();
  await expect(page.getByText("EngineSpeed_New")).toBeVisible();
  await expect(page.getByText("MAX AXIS POINTS")).toBeVisible();
  await expect(page.getByText("16")).toBeVisible();
});
