import { defineConfig } from "vitest/config"

// CORE-4a (ADR-008 ข้อ 6): unit test ของ storefront ใช้ไฟล์ `*.test.ts` ใต้ `src/`
// แยกจาก `e2e/` ของ Playwright (`*.spec.ts` / `*.unit.spec.ts`) เพื่อไม่ให้ runner ทั้งสองชนกัน
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
