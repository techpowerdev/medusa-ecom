import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // [CORE-1] lint error ที่ติดมากับ Medusa Next.js Starter (upstream) ลดเป็น warning เฉพาะไฟล์เหล่านี้
  // เพื่อไม่แก้โค้ด starter (ADR-002: merge จาก upstream ได้ง่าย) แก้จริงเมื่อมี task แตะไฟล์นั้น
  {
    files: [
      "src/lib/data/cart.ts",
      "src/modules/layout/components/language-select/index.tsx",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.config.js",
    "check-env-variables.js",
    "next-sitemap.js",
    // [CORE-5] output ของ Playwright (CI artifact ไม่ใช่ source)
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
])
