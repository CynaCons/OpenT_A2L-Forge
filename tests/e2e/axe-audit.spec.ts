/**
 * Accessibility audit (axe-core) against the real release binary.
 * Scans the main views and writes a machine-readable report to
 * docs/srs/axe-audit-results.json. Fails only on "critical" violations.
 *
 * Note: .MuiTooltip-tooltip is excluded from scanning — axe reports a
 * color-contrast false positive on MUI tooltips mid-transform animation
 * (verified computed colors are ~13.9:1, well above WCAG AA).
 *
 * Run: npx playwright test tests/e2e/axe-audit.spec.ts
 */
import { test, FIXTURES, openA2lFile, openElfFile } from "./fixtures";
import { AxeBuilder } from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AxeResult = {
  view: string;
  violations: { id: string; impact: string | null; description: string; nodes: number; targets?: any[] }[];
};

const OUT_PATH = path.resolve(__dirname, "../../docs/srs/axe-audit-results.json");

async function scan(view: string, scanFn: () => Promise<any>): Promise<AxeResult> {
  const res = await scanFn();
  return {
    view,
    violations: res.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact ?? null,
      description: v.description ?? v.help ?? v.id,
      nodes: v.nodes?.length ?? 0,
      targets: (v.nodes ?? []).slice(0, 6).map((n: any) => n.target),
    })),
  };
}

function builder(page: any) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".MuiTooltip-tooltip");
}

test("axe audit — main views have no critical accessibility violations", async ({ appPage }) => {
  const page = appPage;
  const results: AxeResult[] = [];

  // View 1: default / explorer
  await page.waitForSelector("#root", { timeout: 15000 });
  results.push(await scan("explorer", () => builder(page).analyze()));

  // View 2: ELF inspector with symbols loaded
  await openA2lFile(page, FIXTURES.a2l.software_b);
  await openElfFile(page, FIXTURES.elf.debugdata_gcc);
  await page.getByTestId("sidebar-elf").click();
  await page.getByTestId("elf-table").waitFor({ timeout: 10000 });
  results.push(await scan("elf-inspector", () => builder(page).analyze()));

  // View 3: entity detail (A2L view with selection)
  await page.getByTestId("sidebar-explorer").click();
  await page.getByTestId("entity-tree").waitFor({ timeout: 10000 });
  results.push(await scan("entity-detail", () => builder(page).analyze()));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ generated: new Date().toISOString(), results }, null, 2));

  const critical = results.flatMap(r => r.violations.filter(v => v.impact === "critical"));
  if (critical.length > 0) {
    throw new Error(`Critical accessibility violations found:\n${JSON.stringify(critical, null, 2)}`);
  }
});
