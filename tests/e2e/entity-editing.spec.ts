import path from "node:path";
import { test, expect } from "@playwright/test";

// Mock backend for editing
const mockEditingBackend = () => {
    let state = {
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

    (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: any) => {
            await new Promise(r => setTimeout(r, 20));
            console.log(`[MockEditing] ${cmd}`, args);

            if (cmd === "load_a2l_from_path" || cmd === "load_a2l_from_string") {
                return state.metadata;
            }
            if (cmd === "list_a2l_tree") {
                return {
                    modules: [{
                        id: "mod_1",
                        name: state.metadata.module_names[0],
                        long_identifier: "",
                        sections: [
                            {
                                id: "sec_meas",
                                title: "Measurements",
                                items: state.measurements.map(m => ({
                                    id: m.name,
                                    name: m.name,
                                    kind: "Measurement",
                                    description: m.long_identifier,
                                    details: [
                                        { label: "Limits", value: `${m.lower_limit} .. ${m.upper_limit}` },
                                        { label: "Datatype", value: m.datatype }
                                    ]
                                }))
                            },
                            {
                                id: "sec_char",
                                title: "Characteristics",
                                items: state.characteristics.map(c => ({
                                    id: c.name,
                                    name: c.name,
                                    kind: "Characteristic",
                                    description: c.long_identifier,
                                    details: [
                                        { label: "Address", value: c.address },
                                        { label: "Type", value: c.characteristic_type }
                                    ]
                                }))
                            },
                            {
                                id: "sec_axis",
                                title: "Axis Points",
                                items: state.axis_pts.map(a => ({
                                    id: a.name,
                                    name: a.name,
                                    kind: "AxisPts",
                                    description: a.long_identifier,
                                    details: [
                                        { label: "Input quantity", value: a.input_quantity },
                                        { label: "Max axis points", value: `${a.max_axis_points}` }
                                    ]
                                }))
                            }
                        ]
                    }]
                };
            }
            if (cmd === "get_measurement") return state.measurements.find(x => x.name === args.name);
            if (cmd === "get_characteristic") return state.characteristics.find(x => x.name === args.name);
            if (cmd === "get_axis_pts") return state.axis_pts.find(x => x.name === args.name);

            if (cmd === "update_measurement") {
                const idx = state.measurements.findIndex(x => x.name === args.name);
                if (idx !== -1) state.measurements[idx] = { ...state.measurements[idx], ...args.data };
                return null;
            }
            if (cmd === "update_characteristic") {
                const idx = state.characteristics.findIndex(x => x.name === args.name);
                if (idx !== -1) state.characteristics[idx] = { ...state.characteristics[idx], ...args.data };
                return null;
            }
             if (cmd === "update_axis_pts") {
                const idx = state.axis_pts.findIndex(x => x.name === args.name);
                if (idx !== -1) state.axis_pts[idx] = { ...state.axis_pts[idx], ...args.data };
                return null;
            }
            return null;
        }
    };
};

test("edit core entities (Measurement, Characteristic, AxisPts)", async ({ page }) => {
  await page.addInitScript(mockEditingBackend);
  await page.goto("/");
  
  // Load A2L with entities (Mock ignores content, loads state)
  const fixturePath = path.resolve("tests/fixtures/a2l/sample.a2l");
  await page.setInputFiles("input[type=\"file\"]", {
      name: "test.a2l",
      mimeType: "text/plain",
      buffer: Buffer.from("DUMMY")
  });
  
  await expect(page.getByText("Loaded successfully.")).toBeVisible();

  // --- Measurement Editing ---
  // Expand Measurements (using correct selector for SimpleTreeView)
  await page.getByRole('treeitem', { name: "Measurements" }).click();
  // Click EngineSpeed
  await page.getByRole('treeitem', { name: "EngineSpeed" }).click();
  
  await expect(page.getByRole("heading", { name: "EngineSpeed" })).toBeVisible(); 
  await expect(page.getByText("Engine Speed", { exact: false })).toBeVisible(); // Check description
  
  // Click Edit
  await page.getByRole("button", { name: "Edit Entity" }).click();
  
  // Edit Upper Limit
  await page.getByLabel("Upper Limit").fill("12000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  // Wait for editor to close
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  // Check if save persisted in UI (Limits: 0 .. 12000)
  // App uppercases labels in details view
  await expect(page.getByText("LIMITS")).toBeVisible(); 
  await expect(page.getByText("0 .. 12000")).toBeVisible();

  // --- Characteristic Editing ---
  // Expand Characteristics
  await page.getByRole('treeitem', { name: "Characteristics" }).click();
  await page.getByRole('treeitem', { name: "MaxRPM" }).click();
  
  // Edit
  await page.getByRole("button", { name: "Edit Entity" }).click();
  // Change Address
  await page.getByLabel("Address").fill("0x2020");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  // Wait for editor to close
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  // Verify Address changed
  await expect(page.getByText("ADDRESS")).toBeVisible();
  await expect(page.getByText("0x2020")).toBeVisible();

  // --- AxisPts Editing ---
  // Expand Axis Points
  await page.getByRole('treeitem', { name: "Axis Points" }).click();
  await page.getByRole('treeitem', { name: "RPM_Axis" }).click();

  // Edit
  await page.getByRole("button", { name: "Edit Entity" }).click();
  // Change Max Axis Points
  await page.getByLabel("Max Axis Points").fill("16");
  await page.getByLabel("Input Quantity").fill("EngineSpeed_New");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  
  // Wait for editor to close
  await expect(page.getByRole("button", { name: "Edit Entity" })).toBeVisible();

  // Verify
  // "Input quantity" detail should be updated
  await expect(page.getByText("INPUT QUANTITY")).toBeVisible();
  await expect(page.getByText("EngineSpeed_New")).toBeVisible();
  await expect(page.getByText("MAX AXIS POINTS")).toBeVisible();
  await expect(page.getByText("16")).toBeVisible();
});
