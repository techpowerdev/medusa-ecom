import path from "node:path"
import { defineConfig } from "vitest/config"

// CORE-4a (ADR-008 ข้อ 6): unit test ของ storefront ใช้ไฟล์ `*.test.ts` ใต้ `src/`
// แยกจาก `e2e/` ของ Playwright (`*.spec.ts` / `*.unit.spec.ts`) เพื่อไม่ให้ runner ทั้งสองชนกัน
// CORE-4c2: alias ตาม `paths` ของ tsconfig เพื่อให้ test import server action ที่ใช้ `@lib/*` ได้
// SFUI-1b (spec 09 AC-7): alias "@" → src (`@/*` ของ shadcn) และรวม `*.test.tsx` สำหรับ test ของ component
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@modules": path.resolve(__dirname, "src/modules"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
})
