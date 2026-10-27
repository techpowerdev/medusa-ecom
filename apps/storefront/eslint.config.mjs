import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const LATIN_WORD = "/[A-Za-z]{2,}/"
const TEXT_PROPS = "/^(placeholder|title|alt|aria-label|label)$/"
const LATIN_MESSAGE =
  "ข้อความที่ผู้ใช้เห็นต้องเป็นภาษาไทย (ADR-014) — ชื่อแบรนด์/ชื่อเฉพาะใช้ eslint-disable-next-line พร้อมเหตุผล"

const THAI_UI_RESTRICTED_SYNTAX = [
  // (a) ข้อความใน JSX ที่มีละติน ≥ 2 ตัวติดกัน (รวม string/template ที่เป็นลูกของ element ตรงๆ)
  `JSXText[value=${LATIN_WORD}]`,
  `JSXElement > JSXExpressionContainer > Literal[value=${LATIN_WORD}]`,
  `JSXElement > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${LATIN_WORD}]`,
  // review #102: กิ่งของ ternary / && / || ในลูก JSX เช่น {isLoading ? "Loading..." : children}
  `JSXElement > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > Literal[value=${LATIN_WORD}]`,
  `JSXElement > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > TemplateLiteral > TemplateElement[value.raw=${LATIN_WORD}]`,
  // (b) prop ข้อความ (placeholder, title, alt, aria-label, label)
  `JSXAttribute[name.name=${TEXT_PROPS}] > Literal[value=${LATIN_WORD}]`,
  `JSXAttribute[name.name=${TEXT_PROPS}] > JSXExpressionContainer > Literal[value=${LATIN_WORD}]`,
  `JSXAttribute[name.name=${TEXT_PROPS}] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${LATIN_WORD}]`,
].map((selector) => ({ selector, message: LATIN_MESSAGE }))

// ตาราง "เจ้าของ path" ของ AC-49 (spec 01) — ส่วนของ CORE-4b
const THAI_UI_FILES = [
  "src/app/layout.tsx",
  "src/app/not-found.tsx",
  "src/app/[[]countryCode]/(main)/layout.tsx",
  "src/app/[[]countryCode]/(main)/page.tsx",
  "src/app/[[]countryCode]/(main)/not-found.tsx",
  "src/modules/layout/**",
  "src/modules/home/**",
  // CORE-4b2
  "src/app/[[]countryCode]/(main)/{store,search,categories,collections,products}/**",
  "src/modules/{store,search,categories,collections,products}/**",
  "src/app/buy/**",
  // CORE-4c1 (account, login/register, verify-account)
  "src/app/[[]countryCode]/(main)/{account,verify-account}/**",
  "src/modules/account/**",
  // CORE-4c2 (cart, order, policies ทั้ง 5 หน้า, common, skeletons)
  "src/app/[[]countryCode]/(main)/{cart,order}/**",
  "src/app/[[]countryCode]/(main)/{contact,terms,privacy,returns,shipping}/page.tsx",
  "src/modules/{cart,order,policies,common,skeletons}/**",
  // CORE-4d (checkout ทุกขั้น, shipping nudge, ชื่อวิธีชำระเงิน)
  "src/app/[[]countryCode]/(checkout)/**",
  "src/modules/{checkout,shipping}/**",
  "src/lib/constants.tsx",
  // CORE-20 (หน้าขอคืนสินค้า; page อยู่ใต้ glob account ของ 4c1 แล้ว)
  "src/modules/returns/**",
]

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
    files: ["src/lib/data/cart.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  // [CORE-4b] spec 01 CORE-4 กฎข้อ 4 (ADR-014): path ที่เขียนข้อความไทยแล้วห้ามมีข้อความละตินที่ผู้ใช้เห็น
  // ข้อยกเว้น (ชื่อแบรนด์ ฯลฯ) ใช้ `// eslint-disable-next-line no-restricted-syntax -- <เหตุผล>` ทีละบรรทัด
  // CORE-4c/4d และ task ที่สร้างหน้าใหม่เพิ่ม path ของตัวเองใน `files` (ตาราง "เจ้าของ path" ของ AC-49)
  {
    files: THAI_UI_FILES,
    rules: {
      "no-restricted-syntax": ["error", ...THAI_UI_RESTRICTED_SYNTAX],
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
