import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

// CORE-64: spec 01 กฎข้อ 122 + AC-163(a) — promotion fixed ของร้านตั้ง is_tax_inclusive: true → ลดเท่าที่ตั้งพอดี
// ราคา THB ของ seed รวม VAT 7% (fixture เดียวกับ AC-20c ของ spec 04: สินค้า ฿1,070 qty 1)
// test ฝั่ง true ผ่านบน develop ได้ทันที (พฤติกรรมของ Medusa) — control ฝั่ง false พิสูจน์ว่า test แยกสองฝั่งได้
const SHIPPING_ADDRESS = {
  first_name: "Somchai",
  last_name: "Jaidee",
  address_1: "1 Sukhumvit Rd",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

type Method = {
  type: "fixed" | "percentage"
  target_type: "items" | "order"
  allocation: "each" | "across"
  value: number
}

// รูป body เดียวกับที่ฟอร์มสร้างของ dashboard 2.22.1 ส่ง (create-promotion-form.tsx handleSubmit):
// rules/target_rules/buy_rules เป็น [] , currency_code จาก rule ที่ซ่อน, "each" มี max_quantity (ค่าเริ่มต้น 1),
// "across" ตั้ง max_quantity เป็น null — ต่างจากฟอร์มแค่ status "active" (ฟอร์มเริ่มที่ draft) เพื่อใช้กับ cart ได้ทันที
// is_tax_inclusive: undefined = ไม่ส่ง key
const promotionBody = (code: string, method: Method, is_tax_inclusive?: boolean) => ({
  code,
  type: "standard",
  status: "active",
  is_automatic: false,
  rules: [],
  ...(is_tax_inclusive === undefined ? {} : { is_tax_inclusive }),
  application_method: {
    ...method,
    currency_code: "thb",
    max_quantity: method.allocation === "each" ? 1 : null,
    target_rules: [],
    buy_rules: [],
  },
})

const FIXED_ITEMS: Method = { type: "fixed", target_type: "items", allocation: "each", value: 100 }
const FIXED_ORDER: Method = { type: "fixed", target_type: "order", allocation: "across", value: 100 }
const PERCENT_ITEMS: Method = { type: "percentage", target_type: "items", allocation: "each", value: 10 }

// error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้ ห่อเหลือ status/body
const plain = (what: string) => (e: { response?: { status?: number; data?: unknown } }) => {
  throw new Error(`${what}: ${e.response?.status} ${JSON.stringify(e.response?.data)}`)
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let variantId: string
    let adminHeaders: { headers: Record<string, string> }

    beforeAll(async () => {
      await seedThailand({ container: getContainer(), args: [] })
    })

    // runner reset DB ก่อนทุก test — สร้าง admin, สินค้า ฿1,070 ใหม่ในแต่ละ test
    beforeEach(async () => {
      const container = getContainer()
      pk = await getPublishableKey(container)
      const admin = await createAdminUser(container, "core64-admin@example.com")
      adminHeaders = { headers: admin.headers }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "CORE-64 Tee 1070",
              handle: "core-64-tee-1070",
              status: "published",
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  manage_inventory: false,
                  options: { Size: "One" },
                  prices: [{ currency_code: "thb", amount: 1070 }],
                },
              ],
              sales_channels: channels.map((c) => ({ id: c.id })),
            },
          ],
        },
      })
      variantId = result[0].variants![0].id
    })

    /** สร้าง promotion ผ่าน admin API แล้วใช้กับ cart ใหม่ของลูกค้าเจ้าของ cart คืนส่วนลดที่ได้ */
    const applyPromotion = async (method: Method, is_tax_inclusive?: boolean) => {
      const code = `CORE64-${method.type}-${method.target_type}-${String(is_tax_inclusive)}`.toUpperCase()
      const { data: created } = await api
        .post("/admin/promotions", promotionBody(code, method, is_tax_inclusive), adminHeaders)
        .catch(plain("create promotion"))
      const { data: fetched } = await api
        .get(`/admin/promotions/${created.promotion.id}`, adminHeaders)
        .catch(plain("get promotion"))

      const email = `core64+${Date.now()}${Math.random()}@example.com`
      const { token } = await registerCustomer(api, pk, email, "core64-password").catch(plain("register"))
      const store = storeHeadersFor(pk, token)
      const { data: before } = await api
        .post(
          "/store/carts",
          {
            region_id: regionId,
            shipping_address: SHIPPING_ADDRESS,
            items: [{ variant_id: variantId, quantity: 1 }],
          },
          store
        )
        .catch(plain("create cart"))
      const { data: after } = await api
        .post(`/store/carts/${before.cart.id}/promotions`, { promo_codes: [code] }, store)
        .catch(plain("apply promotion"))

      expect(after.cart.promotions.map((p: { code: string }) => p.code)).toEqual([code])
      return {
        isTaxInclusive: fetched.promotion.is_tax_inclusive as boolean,
        discountTotal: Number(after.cart.discount_total),
        totalDrop: Number(before.cart.total) - Number(after.cart.total),
      }
    }

    describe("fixed + is_tax_inclusive: true ลดเท่าที่ตั้งพอดี (กฎข้อ 122)", () => {
      it("Amount off products: fixed 100 items/each → discount_total = 100 และ total ลด 100", async () => {
        const r = await applyPromotion(FIXED_ITEMS, true)
        expect(r.discountTotal).toBeCloseTo(100, 2)
        expect(r.totalDrop).toBeCloseTo(100, 2)
        expect(r.isTaxInclusive).toBe(true)
      })

      it("Amount off order: fixed 100 order/across → discount_total = 100 และ total ลด 100", async () => {
        const r = await applyPromotion(FIXED_ORDER, true)
        expect(r.discountTotal).toBeCloseTo(100, 2)
        expect(r.totalDrop).toBeCloseTo(100, 2)
        expect(r.isTaxInclusive).toBe(true)
      })

      it("control: fixed 100 items ที่ is_tax_inclusive: false → |discount_total − 100| > 1 (qa #384 O-1)", async () => {
        const r = await applyPromotion(FIXED_ITEMS, false)
        expect(Math.abs(r.discountTotal - 100)).toBeGreaterThan(1)
        expect(r.isTaxInclusive).toBe(false)
      })
    })

    describe("percentage ไม่กระทบ: 10% ของราคารวม VAT = 107", () => {
      it("percentage 10 items ที่ไม่ส่ง is_tax_inclusive → discount_total = 107", async () => {
        const r = await applyPromotion(PERCENT_ITEMS)
        expect(r.discountTotal).toBeCloseTo(107, 2)
      })

      it("percentage 10 items ที่ส่ง is_tax_inclusive: true → discount_total = 107", async () => {
        const r = await applyPromotion(PERCENT_ITEMS, true)
        expect(r.discountTotal).toBeCloseTo(107, 2)
        expect(r.isTaxInclusive).toBe(true)
      })
    })
  },
})
