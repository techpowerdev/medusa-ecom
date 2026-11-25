import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import {
  FORBIDDEN_IMPORT,
  PRESET_RAW_VAR,
  STOREFRONT,
  filesWithForbiddenPattern,
  hasForbiddenPattern,
  legacyClassNames,
  legacyNamesOfClass,
  readSource,
} from "./support/sfui-source"

// SFUI (spec 09 กฎ 15, AC-6): ไฟล์ที่ยังมี pattern ต้องห้าม (import ของชั้น UI เดิม / class ของ preset) ต้องอยู่ใน PENDING
// ของ task เจ้าของไฟล์ (ตารางเจ้าของไฟล์ใน spec 09) — task ที่ย้ายไฟล์เสร็จต้องลบไฟล์ออกจากรายการ และลบ key ของตัวเองใน PR เดียวกัน
// (สร้างใน SFUI-1a จาก origin/develop; หลัง SFUI-6 เหลือเฉพาะข้อ (a) กับรายการว่าง)
type Task =
  | "SFUI-2"
  | "SFUI-3a"
  | "SFUI-3b"
  | "SFUI-3c"
  | "SFUI-3d"
  | "SFUI-3e"
  | "SFUI-4"
  | "SFUI-5a"
  | "SFUI-5b"
  | "SFUI-5c"
  | "SFUI-5d"
  | "SFUI-5e"
  | "SFUI-6"

const TASKS: Task[] = [
  "SFUI-2",
  "SFUI-3a",
  "SFUI-3b",
  "SFUI-3c",
  "SFUI-3d",
  "SFUI-3e",
  "SFUI-4",
  "SFUI-5a",
  "SFUI-5b",
  "SFUI-5c",
  "SFUI-5d",
  "SFUI-5e",
  "SFUI-6",
]

const PENDING: Partial<Record<Task, string[]>> = {
  "SFUI-3a": [
    "src/modules/account/components/address-card/add-address.tsx",
    "src/modules/account/components/address-card/edit-address-modal.tsx",
    "src/modules/common/components/modal/index.tsx",
  ],
  "SFUI-3b": [
    "src/modules/layout/components/search/drawer.tsx",
    "src/modules/layout/components/search/hit.tsx",
    "src/modules/layout/components/search/index.tsx",
    "src/modules/layout/components/side-menu/index.tsx",
    "src/modules/products/components/product-actions/mobile-actions.tsx",
  ],
  "SFUI-3c": [
    "src/modules/account/components/account-info/index.tsx",
    "src/modules/checkout/components/address-select/index.tsx",
    "src/modules/layout/components/cart-dropdown/index.tsx",
    "src/modules/layout/components/country-select/index.tsx",
  ],
  "SFUI-3d": [
    "src/core-19f-continue-after-timeout.test.ts",
    "src/lib/constants.tsx",
    "src/modules/checkout/components/payment-container/index.tsx",
    "src/modules/checkout/components/payment/index.tsx",
    "src/pay-14-stale-session.test.ts",
    "src/pay-16-payment-container.test.ts",
    "src/pay-16-payment-step-state.test.ts",
    "src/payment-session-lock-timeout.test.ts",
  ],
  "SFUI-3e": [
    "src/core-4i-b-ui-results.test.ts",
    "src/modules/checkout/components/shipping/index.tsx",
    "src/modules/order/components/order-pay/index.tsx",
  ],
  "SFUI-4": [
    "src/modules/products/components/product-tabs/accordion.tsx",
    "src/modules/store/components/refinement-list/options-picker/index.tsx",
    "src/modules/store/components/store-refinements/option-refinements.tsx",
    "src/modules/store/components/store-refinements/price-range.tsx",
    "src/modules/store/components/store-refinements/refinement-group.tsx",
  ],
  "SFUI-5a": [
    "src/app/[countryCode]/(main)/contact/page.tsx",
    "src/app/[countryCode]/(main)/not-found.tsx",
    "src/app/[countryCode]/(main)/shipping/page.tsx",
    "src/app/[countryCode]/(main)/verify-account/page.tsx",
    "src/app/not-found.tsx",
    "src/modules/common/components/cart-totals/index.tsx",
    "src/modules/common/components/checkbox/index.tsx",
    "src/modules/common/components/copy-button/index.tsx",
    "src/modules/common/components/delete-button/index.tsx",
    "src/modules/common/components/divider/index.tsx",
    "src/modules/common/components/filter-radio-group/index.tsx",
    "src/modules/common/components/input/index.tsx",
    "src/modules/common/components/interactive-link/index.tsx",
    "src/modules/common/components/line-item-options/index.tsx",
    "src/modules/common/components/line-item-price/index.tsx",
    "src/modules/common/components/line-item-unit-price/index.tsx",
    "src/modules/common/components/native-select/index.tsx",
    "src/modules/layout/components/cart-mismatch-banner/index.tsx",
    "src/modules/layout/templates/footer/index.tsx",
    "src/modules/layout/templates/nav/index.tsx",
    "src/modules/policies/templates/index.tsx",
    "src/modules/shipping/components/free-shipping-price-nudge/index.tsx",
    "src/modules/skeletons/components/skeleton-card-details/index.tsx",
    "src/modules/skeletons/components/skeleton-cart-item/index.tsx",
    "src/modules/skeletons/components/skeleton-line-item/index.tsx",
    "src/modules/skeletons/components/skeleton-product-preview/index.tsx",
    "src/modules/skeletons/templates/skeleton-cart-page/index.tsx",
  ],
  "SFUI-5c": [
    "src/app/[countryCode]/(checkout)/layout.tsx",
    "src/app/[countryCode]/(checkout)/not-found.tsx",
    "src/app/[countryCode]/(main)/cart/not-found.tsx",
    "src/modules/cart/components/cart-error-notice/index.tsx",
    "src/modules/cart/components/cart-item-select/index.tsx",
    "src/modules/cart/components/empty-cart-message/index.tsx",
    "src/modules/cart/components/flash-code-notice/index.tsx",
    "src/modules/cart/components/flash-exceeds-remaining/index.tsx",
    "src/modules/cart/components/item/index.tsx",
    "src/modules/cart/components/sign-in-prompt/index.tsx",
    "src/modules/cart/templates/items.tsx",
    "src/modules/cart/templates/preview.tsx",
    "src/modules/cart/templates/summary.tsx",
    "src/modules/checkout/components/addresses/index.tsx",
    "src/modules/checkout/components/country-select/index.tsx",
    "src/modules/checkout/components/discount-code/index.tsx",
    "src/modules/checkout/components/payment-button/index.tsx",
    "src/modules/checkout/components/payment-test/index.tsx",
    "src/modules/checkout/components/promptpay-payment/index.tsx",
    "src/modules/checkout/components/promptpay-payment/order-delayed.tsx",
    "src/modules/checkout/components/promptpay-payment/qr-panel.tsx",
    "src/modules/checkout/components/refunded-go-to-cart/index.tsx",
    "src/modules/checkout/components/review/index.tsx",
    "src/modules/checkout/components/shipping-address/index.tsx",
    "src/modules/checkout/components/submit-button/index.tsx",
    "src/modules/checkout/templates/checkout-summary/index.tsx",
    "src/modules/returns/components/return-request-form/index.tsx",
  ],
  "SFUI-5d": [
    "src/modules/account/components/account-nav/index.tsx",
    "src/modules/account/components/add-variant-error/index.tsx",
    "src/modules/account/components/login/index.tsx",
    "src/modules/account/components/order-card/index.tsx",
    "src/modules/account/components/order-overview/index.tsx",
    "src/modules/account/components/overview/index.tsx",
    "src/modules/account/components/profile-email/index.tsx",
    "src/modules/account/components/register/index.tsx",
    "src/modules/account/components/verify-account/index.tsx",
    "src/modules/account/templates/account-layout.tsx",
    "src/modules/account/templates/login-template.tsx",
    "src/modules/order/components/help/index.tsx",
    "src/modules/order/components/item/index.tsx",
    "src/modules/order/components/items/index.tsx",
    "src/modules/order/components/order-details/index.tsx",
    "src/modules/order/components/order-pay/pay-buttons.tsx",
    "src/modules/order/components/order-summary/index.tsx",
    "src/modules/order/components/payment-details/index.tsx",
    "src/modules/order/components/shipping-details/index.tsx",
    "src/modules/order/templates/order-completed-template.tsx",
    "src/modules/order/templates/order-details-template.tsx",
  ],
  "SFUI-5e": [
    "src/app/[countryCode]/(main)/account/@dashboard/vouchers/page.tsx",
    "src/app/[countryCode]/(main)/affiliate/earnings/page.tsx",
    "src/app/[countryCode]/(main)/affiliate/page.tsx",
    "src/app/[countryCode]/(main)/affiliate/payouts/page.tsx",
    "src/app/[countryCode]/(main)/affiliate/profile/page.tsx",
    "src/app/[countryCode]/(main)/affiliate/programs/page.tsx",
    "src/modules/affiliate/components/portal-error/index.tsx",
    "src/modules/affiliate/components/portal-nav/index.tsx",
    "src/modules/affiliate/components/product-card/index.tsx",
    "src/modules/affiliate/components/status-notice/index.tsx",
    "src/modules/evoucher/components/partner-block/index.tsx",
    "src/modules/evoucher/components/voucher-card/index.tsx",
    "src/modules/group-buy/components/account-group-orders/index.tsx",
    "src/modules/group-buy/components/account-group-orders/leave-button.tsx",
    "src/modules/group-buy/components/group-page/group-join.tsx",
    "src/modules/group-buy/components/group-page/group-selection-info.tsx",
    "src/modules/group-buy/components/group-page/index.tsx",
  ],
  "SFUI-6": [
    "src/modules/common/components/radio/index.tsx",
    // SFUI-2: unit ของ shim (import shim = pattern ต้องห้าม) — ลบพร้อมโฟลเดอร์ shim ใน SFUI-6
    "src/modules/common/components/ui/index.test.tsx",
  ],
}

const pendingFiles = Object.values(PENDING).flat()

test("AC-6 (a): ทุกไฟล์ที่มี pattern ต้องห้ามอยู่ใน PENDING ของ task ใด task หนึ่ง", () => {
  const missing = filesWithForbiddenPattern().filter((file) => !pendingFiles.includes(file))
  expect(missing, "ไฟล์ที่มี pattern ต้องห้ามแต่ไม่อยู่ใน PENDING").toEqual([])
})

test("AC-6 (b): ทุกไฟล์ใน PENDING ยังมีอยู่และยังมี pattern (ย้ายเสร็จแล้วต้องลบออกจากรายการ)", () => {
  const stale = pendingFiles.filter(
    (file) => !fs.existsSync(path.join(STOREFRONT, file)) || !hasForbiddenPattern(file, readSource(file))
  )
  expect(stale, "ไฟล์ใน PENDING ที่ไม่มี pattern แล้ว/ไม่มีไฟล์").toEqual([])
})

test("AC-6 (c): key ของ PENDING เป็น task ที่ยังไม่ merge เท่านั้น และไม่มีไฟล์ซ้ำข้าม task", () => {
  for (const key of Object.keys(PENDING)) expect(TASKS, key).toContain(key)
  expect(new Set(pendingFiles).size).toBe(pendingFiles.length)
})

// positive/negative control ของตัวจับ pattern
test("AC-6: ตัวจับ class ของ preset แยก variant/important/opacity และไม่นับ class ของ Tailwind ปกติ", () => {
  expect(legacyNamesOfClass("hover:text-ui-fg-base")).toEqual(["text-ui-fg-base"])
  expect(legacyNamesOfClass("group-disabled:!shadow-borders-base")).toEqual(["shadow-borders-base"])
  expect(legacyNamesOfClass("small:txt-compact-xlarge-plus")).toEqual(["txt-compact-xlarge-plus"])
  expect(legacyNamesOfClass("bg-ui-bg-base/50")).toEqual(["bg-ui-bg-base"])
  expect(legacyNamesOfClass("group-radix-state-open:rotate-180")).toEqual(["group-radix-state-open"])
  expect(legacyNamesOfClass("data-[state=open]:h1-webs")).toEqual(["h1-webs"])
  for (const plain of ["text-small-regular", "text-gray-700", "shadow-sm", "bg-white", "rounded-rounded", "h-1"]) {
    expect(legacyNamesOfClass(plain), plain).toEqual([])
  }
  expect(legacyClassNames("x.tsx", '// txt-medium ใน comment\nconst a = <p className="txt-medium" />')).toEqual([
    "txt-medium",
  ])
  expect(legacyClassNames("x.tsx", "// txt-medium ใน comment เท่านั้น")).toEqual([])
  expect(FORBIDDEN_IMPORT.test('vi.mock("@headlessui/react", () => ({}))')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import { X } from "@modules/common/components/ui"')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import X from "@modules/common/components/modal/index"')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import { cn } from "@/lib/utils"')).toBe(false)
})

// กฎ 15 (แก้ใน spec 09): ตัวแปรดิบของ preset `var(--fg-*|--bg-*|--border-*)` นับเป็น pattern ต้องห้าม
// — ไม่งั้นเอาไฟล์ออกจาก PENDING ได้ทั้งที่ยังอ้างตัวแปร แล้ว SFUI-6 ลบ legacy CSS ทำให้สี (เช่น ลูกศร InteractiveLink) หายเงียบ
test("AC-6: ตัวแปรดิบของ preset var(--fg-*/--bg-*/--border-*) ในไฟล์ที่ไม่ใช่ test นับเป็น pattern ต้องห้าม", () => {
  expect(hasForbiddenPattern("x.tsx", '<ArrowUpRight color="var(--fg-interactive)" />')).toBe(true)
  expect(hasForbiddenPattern("x.tsx", 'const s = { color: "var(--bg-subtle)", borderColor: "var(--border-base)" }')).toBe(true)
  expect(hasForbiddenPattern("x.tsx", 'const f = "var(--font-noto-sans-thai)"')).toBe(false)
  expect(hasForbiddenPattern("x.tsx", 'const c = "var(--color-ui-fg-base)"')).toBe(false)
  expect(hasForbiddenPattern("x.test.ts", 'const c = "var(--fg-muted)"')).toBe(false)
  expect(PRESET_RAW_VAR.test("var(--fg-muted)")).toBe(true)
})

test("AC-6: ไฟล์ที่อ้าง var(--fg-*) อยู่ใน PENDING ของ task เจ้าของไฟล์", () => {
  expect(PENDING["SFUI-5a"]).toEqual(
    expect.arrayContaining(["src/app/not-found.tsx", "src/modules/common/components/interactive-link/index.tsx"])
  )
  expect(PENDING["SFUI-5c"]).toContain("src/modules/checkout/components/discount-code/index.tsx")
})
