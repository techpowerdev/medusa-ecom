import { defineConfig, devices } from "@playwright/test"

// CORE-5: ทุก test เก็บ trace + screenshot ทุก step (ผ่าน fixture `step` ใน e2e/support/fixtures.ts)
// ไว้ใน playwright-report/ และ test-results/ ซึ่ง CI อัปโหลดเป็น artifact 14 วัน (ไม่เก็บใน git)
// screenshot สำคัญ (≤5 รูป, PNG ≤300KB) ลง docs/evidence/ เฉพาะเมื่อรันด้วย E2E_SAVE_EVIDENCE=1
const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8000",
    viewport: { width: 1280, height: 720 },
    screenshot: "on",
    trace: "on",
    video: "off",
  },
  projects: [
    {
      // pure logic (กฎ evidence) — ไม่ต้องใช้ browser หรือ server
      name: "unit",
      testMatch: /.*\.unit\.spec\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /.*\.unit\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
})
