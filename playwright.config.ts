import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  testIgnore: ["**/elf-reader.ts", "**/fixtures.ts", "**/global-*.ts", "**/mocks.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
});
