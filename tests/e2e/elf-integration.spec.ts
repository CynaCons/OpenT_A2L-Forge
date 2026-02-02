import { test, expect } from "@playwright/test";

// --- Stateful Mock ---
const mockElfBackend = () => {
    // Persistent Storage Key
    const DISK_KEY = "mock_filesystem_elf_test";

    // Initial A2L State
    const INITIAL_STATE = {
        metadata: {
            project_name: "elf_integration_proj",
            project_long_identifier: "Integration Test Project",
            module_names: ["TargetModule"],
            warning_count: 0
        },
        measurements: [
            {
                name: "ExistingMeasurement",
                kind: "Measurement",
                long_identifier: "Always here",
                datatype: "UBYTE",
                lower_limit: 0,
                upper_limit: 100
            }
        ],
        // Dummy ELF Symbols simulating a parsed file
        elf_symbols: [
            { name: "New_Variable_A", address: 0x1000, size: 4, bind: "GLOBAL", type_str: "OBJECT", section: ".data" },
            { name: "Static_Var_B", address: 0x2000, size: 2, bind: "LOCAL", type_str: "OBJECT", section: ".bss" },
            { name: "Func_Main", address: 0x3000, size: 100, bind: "GLOBAL", type_str: "FUNC", section: ".text" }
        ]
    };

    let memoryState: any = null;

    (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: any) => {
            // Emulate network latency
            await new Promise(r => setTimeout(r, 30));
            console.log(`[ElfMock] ${cmd}`, args);

            // -- Load Memory from Disk on First Access --
            if (!memoryState) {
                const existing = localStorage.getItem(DISK_KEY);
                memoryState = existing ? JSON.parse(existing) : JSON.parse(JSON.stringify(INITIAL_STATE));
            }

            switch (cmd) {
                case "load_a2l_from_path":
                case "load_a2l_from_string":
                    // Reset to disk state or initial state on "Load"
                    // If we assume "Load" means "Open File", we might want to respect what's on disk
                    // But for test repeatability, we might want to ensure a clean slate if loading a specific "fixture" name?
                    // For this test, let's assume loading "any" A2L loads our state.
                    return memoryState.metadata;

                case "list_a2l_tree":
                    return {
                        modules: [{
                            id: "mod_main",
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
                                        details: []
                                    }))
                                }
                            ]
                        }]
                    };

                case "get_measurement": {
                    const found = memoryState.measurements.find((m: any) => m.name === args.name);
                    if (found) return found;
                    throw "Measurement not found";
                }

                // --- ELF Specifics ---
                case "load_elf_symbols":
                    // Return our dummy symbols
                    return memoryState.elf_symbols;

                case "create_measurements_from_elf": {
                    // Args: { moduleName, symbols: [] }
                    // 1. Identify symbols to add
                    const symbolsToAdd = args.symbols;
                    
                    // 2. Add them to "RAM"
                    for (const sym of symbolsToAdd) {
                        // Check if exists to avoid dupe in this toy mock
                        if (!memoryState.measurements.find((m: any) => m.name === sym.name)) {
                            memoryState.measurements.push({
                                name: sym.name,
                                kind: "Measurement",
                                long_identifier: "",
                                datatype: "UBYTE", // Default from Rust impl
                                lower_limit: 0,
                                upper_limit: 255,
                                ecu_address: `0x${sym.address.toString(16).toUpperCase()}`
                            });
                        }
                    }
                    
                    // 3. Return updated metadata (implied success)
                    return {
                        metadata: memoryState.metadata,
                        entities: [] // Not strictly used by frontend for this Op usually
                    };
                }

                case "save_a2l_to_path":
                    // Commit RAM to Disk
                    localStorage.setItem(DISK_KEY, JSON.stringify(memoryState));
                    console.log("[ElfMock] Saved to disk");
                    return null;

                default:
                    return null;
            }
        }
    };
};

test.describe("ELF to A2L Integration", () => {
    test.beforeEach(async ({ page }) => {
        // Clear previous state to ensure repeatability (Run once in Node context, not on every page load)
        // We need to be on a page to access localStorage, main test goes to "/" anyway so we can just do it or rely on a preliminary nav
        // But simply removing the AddInitScript for removeItem is key.
        
        // Shim File.path for Playwright environment to mimic Tauri
        await page.addInitScript(() => {
            Object.defineProperty(File.prototype, 'path', {
                get() { return "c:\\fake\\path\\" + this.name; }
            });
        });

        // Mock Backend
        await page.addInitScript(mockElfBackend);
    });
    
    test("load ELF, browse symbols, add to A2L, and persist", async ({ page }) => {
         // 0. Cleanup
         await page.goto("/");
         await page.evaluate(() => localStorage.removeItem("mock_filesystem_elf_test"));
         await page.reload(); // Reload to ensure mock picks up clean state or just rely on flow

        // 1. App Start
        // (Already on /)
        
         page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
        
        // 2. Load A2L (Trigger mock load)
        await page.setInputFiles('input[type="file"][accept=".a2l"]', {
            name: "software_a.a2l",
            mimeType: "text/plain",
            buffer: Buffer.from("dummy")
        });
        await expect(page.getByRole("heading", { name: "ExistingMeasurement" })).toBeVisible();

        // 3. Switch to ELF View
        // The sidebar button has a tooltip "ELF Symbols"
        await page.getByLabel("ELF Symbols").click();
        await expect(page.getByText("ELF INSPECTOR")).toBeVisible();

        // 4. Load ELF File (Trigger mock load_elf_symbols)
        // Note: The input is hidden inside the button or box
        await page.setInputFiles('input[type="file"]:not([accept=".a2l"])', {
            name: "software_b.elf",
            mimeType: "application/octet-stream",
            buffer: Buffer.from("dummy_elf")
        });

        // 5. Browse/Verify Symbols
        // Expect table to appear with our mock data
        // We use first() or a more precise locator if duplicates exist, but cells should be unique here
        await expect(page.getByRole("cell", { name: "New_Variable_A", exact: true })).toBeVisible();
        
        // Note: 0x1000 might conform to the renderer. 
        // Backend says 0x1000, renderer says "0x1000" in upper case usually
        await expect(page.getByRole("cell", { name: "0x1000" })).toBeVisible();
        await expect(page.getByRole("cell", { name: "Func_Main", exact: true })).toBeVisible();

        // 6. Select "New_Variable_A"
        // Find the row for New_Variable_A and check the checkbox
        const row = page.getByRole("row").filter({ hasText: "New_Variable_A" });
        await row.getByRole("checkbox").check();

        // 7. Click "Add to Project"
        await page.getByRole("button", { name: "Add to Project" }).click();
        await expect(page.getByText("Added 1 measurements.")).toBeVisible();

        // 8. Verify it appears in Tree (Switch back to Explorer)
        await page.getByLabel("Explorer").click();

        // Ensure "Measurements" is expanded
        await page.getByRole('treeitem', { name: "Measurements" }).click();

        // Refresh triggers list_a2l_tree, verify we have the new item
        // Expand Measurements if needed (mock usually returns open or we click)
        const newMeas = page.getByRole("treeitem", { name: "New_Variable_A" });
        await expect(newMeas).toBeVisible();
        
        // 9. Inspect Details (verify Address)
        await newMeas.click();
        await expect(page.getByRole("heading", { name: "New_Variable_A" })).toBeVisible();
        // The mock impl sets address: 0x1000
        // Frontend details view often upper-cases things or formats them
        // Let's check for the address. Mock says "ecu_address".
        // Rust impl details(): opt_detail("ECU address", &self.ecu_address)
        // If the mock `get_measurement` returns it, it should show.
        // Wait, `get_measurement` in mock returns the raw object. 
        // `list_a2l_tree` in mock returns `details: []`. 
        // Ah, `list_a2l_tree` mock in `mockElfBackend` returns EMPTY details array.
        // So the "PROPERTIES" card will be empty unless we fix the mock or rely on "Edit" view.
        
        // Let's verify via "Edit", which calls `get_measurement`
        await page.getByRole("button", { name: "Edit Entity" }).click();
        await expect(page.getByLabel("ECU Address")).toHaveValue("0x1000");
        await page.getByRole("button", { name: "Cancel" }).click();

        // 10. Save A2L
        page.once("dialog", d => d.accept("c:/mock/save.a2l")); // Handle Save As if needed
        await page.getByLabel("Save A2L").click();
        await expect(page.getByText("Saved successfully.")).toBeVisible();

        // 11. Close & Reopen (Reload Page)
        await page.reload();

        // 12. Load A2L again (Should load from Disk state)
        await page.setInputFiles('input[type="file"][accept=".a2l"]', {
             name: "software_a.a2l",
             mimeType: "text/plain",
             buffer: Buffer.from("dummy")
        });

        // 13. Verify Persistence of New Variable
        // Expand Measurements
        await page.getByRole('treeitem', { name: "Measurements" }).click();
        
        // Use treeitem locator to avoid strict mode violation if multiple texts exist
        const persistedItem = page.getByRole("treeitem", { name: "New_Variable_A" });
        await expect(persistedItem).toBeVisible();
        await persistedItem.click();
        
        // Verify address again
        await page.getByRole("button", { name: "Edit Entity" }).click();
        await expect(page.getByLabel("ECU Address")).toHaveValue("0x1000");
    });
});
