import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  test,
  expect,
  FIXTURES,
  openA2lFile,
  openElfFile,
  openCliProject,
  saveCliProject,
} from "./fixtures";

test.describe("CLI Sync Project Authoring", () => {
  test("saves and reloads tracked struct roots plus exact leaf selections", async ({ appPage: page }) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opent-a2l-forge-cli-project-"));
    const projectPath = path.join(tempDir, "tracked-project.json");

    await openA2lFile(page, FIXTURES.a2l.from_source_structs);
    await page.getByTestId("sidebar-elf").click();
    await openElfFile(page, FIXTURES.elf.update_typedef_test);
    await expect(page.getByTestId("elf-row-struct_b")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("elf-row-val_u8")).toBeVisible({ timeout: 15000 });

    await page.getByTestId("checkbox-elf-struct_b").click();
    await page.getByTestId("elf-row-val_u8").click();
    await expect(page.getByTestId("btn-save-cli-project")).toBeEnabled();

    await saveCliProject(page, projectPath);
    await expect.poll(() => fs.existsSync(projectPath)).toBeTruthy();

    await page.getByTestId("checkbox-elf-struct_b").click();
    await page.getByTestId("elf-row-val_u8").click();
    await expect(page.getByTestId("checkbox-elf-struct_b").locator("input")).not.toBeChecked();
    await expect(page.getByTestId("checkbox-elf-val_u8").locator("input")).not.toBeChecked();

    await openCliProject(page, projectPath);
    await expect(page.getByTestId("checkbox-elf-struct_b").locator("input")).toBeChecked({ timeout: 15000 });
    await expect(page.getByTestId("checkbox-elf-val_u8").locator("input")).toBeChecked({ timeout: 15000 });

    const savedProject = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    expect(savedProject.selectors).toEqual(
      expect.arrayContaining([
        { kind: "struct_root", name: "struct_b" },
        { kind: "symbol", name: "val_u8" },
      ]),
    );
  });
});
