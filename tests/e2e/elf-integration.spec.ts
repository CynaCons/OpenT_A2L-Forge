import { test, expect } from "@playwright/test";
import { setupTauriMock, type MockState } from "./mocks";

test("End-to-end: Load A2L, Load ELF, Add Variable, Save, Reload, Verify", async ({ page }) => {
    
    // 1. Setup Mock Backend with Persistence
    const DISK_KEY = "mock_filesystem_elf_test";
    const INITIAL_STATE: MockState = {
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
                upper_limit: 100,
                conversion: "Ident", resolution: 1, accuracy: 0
            }
        ],
        elf_symbols: [
            { name: "New_Variable_A", address: 0x1000, size: 4, bind: "GLOBAL", type_str: "OBJECT", section: ".data" },
            { name: "Static_Var_B", address: 0x2000, size: 2, bind: "LOCAL", type_str: "OBJECT", section: ".bss" },
            { name: "Func_Main", address: 0x3000, size: 100, bind: "GLOBAL", type_str: "FUNC", section: ".text" }
        ]
    };

    // Install Mock (pass serialized args)
    await page.addInitScript(setupTauriMock, { initialState: INITIAL_STATE, persistenceKey: DISK_KEY });
    
    // Shim File.path
    await page.addInitScript(() => {
        Object.defineProperty(File.prototype, "path", {
            get() { return this._path || "c:\\fake\\path\\" + this.name; },
            set(value) { this._path = value; }
        });
    });

    // 0. Cleanup LocalStorage from previous runs
    await page.goto("/");
    await page.evaluate((k: string) => localStorage.removeItem(k), DISK_KEY);
    await page.reload();

    // 2. Load A2L (Trigger mock load)
    await page.setInputFiles('input[type="file"][accept=".a2l"]', {
        name: "software_a.a2l",
        mimeType: "text/plain",
        buffer: Buffer.from("dummy")
    });
    
    // 3. Switch to ELF View
    await page.getByLabel("ELF Symbols").click();
    await expect(page.getByText("ELF INSPECTOR")).toBeVisible();

    // 4. Load ELF File
    await page.setInputFiles('input[type="file"]:not([accept=".a2l"])', {
        name: "software_b.elf",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("dummy_elf")
    });

    // 5. Verify Symbols
    await expect(page.getByRole("cell", { name: "New_Variable_A", exact: true })).toBeVisible();

    // 6. Select "New_Variable_A"
    const row = page.getByRole("row").filter({ hasText: "New_Variable_A" });
    await row.getByRole("checkbox").check();

    // 7. Add to Project
    await page.getByRole("button", { name: "Add to Project" }).click();
    await expect(page.getByText("Added 1 measurements.")).toBeVisible();

    // 8. Verify in Tree
    await page.getByLabel("Explorer").click();
    await page.getByRole('treeitem', { name: "Measurements" }).click();
    const newMeas = page.getByRole("treeitem", { name: "New_Variable_A" });
    await expect(newMeas).toBeVisible();
    
    // 9. Inspect Details via Edit
    await newMeas.click();
    await page.getByRole("button", { name: "Edit Entity" }).click();
    // note: mock expects hex address string or number, handled in mocks.ts logic
    await expect(page.getByLabel("ECU Address")).toHaveValue("0x1000"); 
    await page.getByRole("button", { name: "Cancel" }).click();

    // 10. Save A2L
    await page.getByLabel("Save A2L").click();
    await expect(page.getByText("Saved successfully.")).toBeVisible();

    // 11. Reload and Verify Persistence
    await page.reload();
    await page.setInputFiles('input[type="file"][accept=".a2l"]', {
         name: "software_a.a2l",
         mimeType: "text/plain",
         buffer: Buffer.from("dummy")
    });

    await page.getByRole('treeitem', { name: "Measurements" }).click();
    await expect(page.getByRole("treeitem", { name: "New_Variable_A" })).toBeVisible(); // Check persistence
});
