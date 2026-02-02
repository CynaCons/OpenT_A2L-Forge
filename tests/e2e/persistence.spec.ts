// tests/e2e/persistence.spec.ts
import { test, expect } from "@playwright/test";

// Defined locally to be injected into the browser context
const mockBackendLogic = () => {
  // Use a unique key for the "disk" storage
  const DISK_KEY = "mock_filesystem_a2l";
  
  // Initial file content "on disk"
  const INITIAL_STATE = {
    metadata: {
      project_name: "test_project",
      project_long_identifier: "Test Project Persist",
      module_names: ["test_module"],
      warning_count: 0
    },
    measurements: [
      {
        name: "Test_Measurement",
        long_identifier: "A measurement for testing persistence",
        datatype: "UBYTE",
        conversion: "NO_COMPU_METHOD",
        resolution: 1,
        accuracy: 0,
        lower_limit: 0,
        upper_limit: 255,
        ecu_address: "0x1234",
        kind: "Measurement"
      }
    ]
  };

  // State in RAM (Backend Memory)
  // We attach it to window so we can inspect it if needed, but primarily it's closure-scoped
  let memoryState: any = null;

  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: any) => {
      console.log(`[StatefulMock] ${cmd}`, args);
      
      // Delay slightly to simulate async
      await new Promise(r => setTimeout(r, 50));

      switch (cmd) {
        case "load_a2l_from_path": 
        case "load_a2l_from_string": {
          // Read from "Disk"
          const rawDisk = localStorage.getItem(DISK_KEY);
          if (rawDisk) {
            memoryState = JSON.parse(rawDisk);
          } else {
            memoryState = JSON.parse(JSON.stringify(INITIAL_STATE));
          }
          return memoryState.metadata;
        }

        case "list_a2l_tree": {
           if (!memoryState) throw "No A2L loaded";
           return {
             modules: [{
               id: "mod_1",
               name: memoryState.metadata.module_names[0],
               long_identifier: "",
               sections: [
                 {
                   id: "sec_meas",
                   title: "Measurements",
                   items: memoryState.measurements.map((m: any) => ({
                     id: m.name,
                     name: m.name,
                     kind: "Measurement",
                     description: m.long_identifier,
                     details: [
                        { label: "Limits", value: `${m.lower_limit} .. ${m.upper_limit}` },
                        { label: "Datatype", value: m.datatype }
                     ]
                   }))
                 }
               ]
             }]
           };
        }

        case "get_measurement": {
            const m = memoryState.measurements.find((x: any) => x.name === args.name);
            if (!m) throw "Not found";
            return m;
        }

        case "update_measurement": {
            // Update "RAM"
            const idx = memoryState.measurements.findIndex((x: any) => x.name === args.name);
            if (idx === -1) throw "Not found";
            // Merge updates
            memoryState.measurements[idx] = { ...memoryState.measurements[idx], ...args.data };
            return null; // OK
        }

        case "save_a2l_to_path": {
            // Write RAM to Disk
            localStorage.setItem(DISK_KEY, JSON.stringify(memoryState));
            return null;
        }

        default:
          console.warn(`[StatefulMock] Unhandled command: ${cmd}`);
          return null;
      }
    }
  };
};

test.describe("Entity Persistence", () => {
  test.beforeEach(async ({ page }) => {
     // Inject the mock logic before the app loads
     await page.addInitScript(mockBackendLogic);
  });

  test("edits to measurement limits persist after app restart", async ({ page }) => {
    // 1. Open App
    await page.goto("/");

    // 2. Load "File" (Triggers load_a2l_from_path -> loads INITIAL_STATE)
    // We use setInputFiles to trigger the handleFileSelect logic in App.tsx
    // The actual file content doesn't matter because our mock intercepts "load_a2l_from_string/path" 
    // and ignores the content/path arguments, serving INITIAL_STATE instead.
    await page.setInputFiles("input[type='file']", {
      name: "test.a2l",
      mimeType: "text/plain",
      buffer: Buffer.from("DUMMY CONTENT")
    });

    // 3. Verify Initial State
    // The app auto-selects the first item, so the detail view should be visible immediately.
    // We check the heading to confirm we are looking at the right entity.
    await expect(page.getByRole("heading", { name: "Test_Measurement" })).toBeVisible();

    // Check Properties card shows limits 0 .. 255
    await expect(page.getByText("Limits")).toBeVisible();
    await expect(page.getByText("0 .. 255")).toBeVisible();
    await expect(page.getByText("Limits")).toBeVisible();
    await expect(page.getByText("0 .. 255")).toBeVisible();

    // 4. Edit
    await page.getByRole("button", { name: "Edit Entity" }).click();
    
    // Change Lower Limit to 50
    // Note: The helper text/label might be "Lower Limit"
    const lowerInput = page.getByLabel("Lower Limit", { exact: false });
    await lowerInput.fill("50");
    
    // Change Upper Limit to 200
    const upperInput = page.getByLabel("Upper Limit", { exact: false });
    await upperInput.fill("200");

    // Click Save (In the editor dialog)
    await page.getByRole("button", { name: "Save", exact: true }).click();
    
    // Verify UI updated in the detail view
    await expect(page.getByText("50 .. 200")).toBeVisible();

    // 5. Persist to Disk
    // Handle the "Save As" prompt since mapped/virtual files don't have a path
    page.once("dialog", dialog => dialog.accept("c:/mock/disk/save.a2l"));

    // Click the main "Save A2L" button in the sidebar
    await page.getByLabel("Save A2L").click();
    await expect(page.getByText("Saved successfully.")).toBeVisible();

    // 6. "Close App" and "Reopen" (Reload Page)
    await page.reload();

    // 7. Load File Again
    // This time, the mock backend will see the data in localStorage and serve the MODIFIED state
    await page.setInputFiles("input[type='file']", {
        name: "test.a2l",
        mimeType: "text/plain",
        buffer: Buffer.from("DUMMY CONTENT")
      });

    // 8. Verify Persistence
    // Again, auto-selection should bring up the item.
    await expect(page.getByRole("heading", { name: "Test_Measurement" })).toBeVisible();
    
    // Should show the NEW limits
    await expect(page.getByText("50 .. 200")).toBeVisible();
    
    // Ensure it is NOT the old values (redundant but good for clarity)
    await expect(page.getByText("0 .. 255")).not.toBeVisible();
  });
});
