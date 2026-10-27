import { ESLint } from "eslint"
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// spec 01 CORE-4 (ADR-014): storefront ภาษาไทยอย่างเดียว
const ROOT = path.resolve(__dirname, "..")

// AC-47 (กฎข้อ 4): ESLint `no-restricted-syntax` กันข้อความละตินใน path ที่เขียนไทยแล้ว
describe("ESLint rule ข้อความไทย (AC-47)", () => {
  const eslint = new ESLint({ cwd: ROOT })
  const FIXTURE = path.join(ROOT, "src/modules/layout/components/__fixture__.tsx")

  const errorsOf = async (jsx: string) => {
    const code = `export const F = ({ price }: { price: number }) => (\n${jsx}\n)\n`
    const [result] = await eslint.lintText(code, { filePath: FIXTURE })
    return result.messages.filter((m) => m.ruleId === "no-restricted-syntax")
  }

  it.each([
    ["<p>Hello</p>"],
    ['<input placeholder="Search" />'],
    ["<p>{`Cart (${price})`}</p>"],
    ['<button aria-label={"Close menu"} />'],
    // review #102: string ใน expression ของลูก JSX (ternary / && / ||) ก็เป็นข้อความที่ผู้ใช้เห็น
    ['<button>{price ? "Loading..." : "ซื้อ"}</button>'],
    ['<p>{price && "Out of stock"}</p>'],
    ["<p>{price ? `Only ${price}` : null}</p>"],
  ])("%s → error", async (jsx) => {
    expect(await errorsOf(jsx)).toHaveLength(1)
  })

  it.each([
    ["<p>สวัสดี</p>"],
    ["<p>{price} ฿</p>"],
    [
      "<p>\n{/* eslint-disable-next-line no-restricted-syntax -- brand */}\n<span>PromptPay</span>\n</p>",
    ],
    ['<input placeholder="ค้นหาสินค้า" className="txt-medium" data-testid="search-input" />'],
    ['<button>{price ? "กำลังดำเนินการ..." : "ซื้อ"}</button>'],
    ['<p className={price ? "text-red-500" : "text-ui-fg-base"}>สวัสดี</p>'],
  ])("%s → ไม่มี error", async (jsx) => {
    expect(await errorsOf(jsx)).toHaveLength(0)
  })

  it.each([
    "src/app/layout.tsx",
    "src/app/not-found.tsx",
    "src/app/[countryCode]/(main)/layout.tsx",
    "src/app/[countryCode]/(main)/page.tsx",
    "src/app/[countryCode]/(main)/not-found.tsx",
    "src/modules/layout/templates/nav/index.tsx",
    "src/modules/home/components/hero/index.tsx",
    // CORE-4b2
    "src/app/[countryCode]/(main)/store/page.tsx",
    "src/app/[countryCode]/(main)/search/page.tsx",
    "src/app/[countryCode]/(main)/categories/[...category]/page.tsx",
    "src/app/[countryCode]/(main)/collections/[handle]/page.tsx",
    "src/app/[countryCode]/(main)/products/[handle]/page.tsx",
    "src/modules/store/templates/index.tsx",
    "src/modules/search/components/search-form/index.tsx",
    "src/modules/categories/templates/index.tsx",
    "src/modules/collections/templates/index.tsx",
    "src/modules/products/components/product-actions/index.tsx",
    "src/app/buy/[items]/route.ts",
    // CORE-4c1 (account, login/register, verify-account)
    "src/app/[countryCode]/(main)/account/layout.tsx",
    "src/app/[countryCode]/(main)/account/@login/page.tsx",
    "src/app/[countryCode]/(main)/account/@dashboard/profile/page.tsx",
    "src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page.tsx",
    "src/app/[countryCode]/(main)/verify-account/page.tsx",
    "src/modules/account/components/register/index.tsx",
    "src/modules/account/templates/account-layout.tsx",
    // CORE-4c2 (cart, order, policies, common, skeletons)
    "src/app/[countryCode]/(main)/cart/page.tsx",
    "src/app/[countryCode]/(main)/cart/not-found.tsx",
    "src/app/[countryCode]/(main)/order/[id]/confirmed/page.tsx",
    "src/app/[countryCode]/(main)/contact/page.tsx",
    "src/app/[countryCode]/(main)/terms/page.tsx",
    "src/app/[countryCode]/(main)/privacy/page.tsx",
    "src/app/[countryCode]/(main)/returns/page.tsx",
    "src/app/[countryCode]/(main)/shipping/page.tsx",
    "src/modules/cart/templates/index.tsx",
    "src/modules/order/templates/order-details-template.tsx",
    "src/modules/policies/templates/index.tsx",
    "src/modules/common/components/native-select/index.tsx",
    "src/modules/common/components/filter-radio-group/index.tsx",
    "src/modules/skeletons/templates/skeleton-cart-page/index.tsx",
    // CORE-4d (checkout ทุกขั้น, shipping nudge, ชื่อวิธีชำระเงิน)
    "src/app/[countryCode]/(checkout)/layout.tsx",
    "src/app/[countryCode]/(checkout)/not-found.tsx",
    "src/app/[countryCode]/(checkout)/checkout/page.tsx",
    "src/modules/checkout/components/payment/index.tsx",
    "src/modules/checkout/components/promptpay-payment/index.tsx",
    "src/modules/checkout/templates/checkout-summary/index.tsx",
    "src/modules/shipping/components/free-shipping-price-nudge/index.tsx",
    "src/lib/constants.tsx",
    // CORE-20 (หน้าขอคืนสินค้า — page อยู่ใต้ glob account ของ 4c1)
    "src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/return/page.tsx",
    "src/modules/returns/components/return-request-form/index.tsx",
  ])("เปิด rule กับ %s (path ในตาราง AC-49)", async (file) => {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file))
    expect(config.rules["no-restricted-syntax"]?.[0]).toBe(2)
  })

  it.each([
    // ไฟล์สำหรับเครื่อง (llms.txt) ไม่อยู่ในตาราง AC-49 — glob ของ 4d ต้องไม่จับ lib อื่นนอก constants.tsx
    "src/lib/util/product-markdown.ts",
    "src/lib/data/cart.ts",
  ])("ไม่เปิด rule กับ %s (ไม่อยู่ในตาราง AC-49)", async (file) => {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file))
    expect(config.rules["no-restricted-syntax"]).toBeUndefined()
  })
}, 60_000)

// AC-46 (กฎข้อ 6) ส่วนอ่านไฟล์: ไม่มี i18n library / ไฟล์ข้อความ / ตัวเลือกภาษา
describe("ไม่มี i18n ในระยะแรก (AC-46)", () => {
  it("ไม่มี dependency next-intl และไม่มีโฟลเดอร์ messages/", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty("next-intl")
    expect(fs.existsSync(path.join(ROOT, "messages"))).toBe(false)
  })

  it("ลบ component language-select แล้ว", () => {
    expect(
      fs.existsSync(path.join(ROOT, "src/modules/layout/components/language-select"))
    ).toBe(false)
  })
})
