import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev15-admin@example.com"
const ADMIN_PASSWORD = "ev15-test-password"
const BUYER_EMAIL = "ev15-buyer@example.com"
const VOUCHER_PRICE = 500
const ADDRESS = {
  first_name: "สมชาย",
  last_name: "ใจดี",
  address_1: "99 ถนนสุขุมวิท",
  city: "วัฒนา",
  postal_code: "10110",
  country_code: "th",
}

type Cart = {
  id: string
  total: number
  shipping_total: number
  items: { id: string; variant_id: string }[]
  shipping_methods: { id: string; shipping_option_id: string }[]
  payment_collection?: { id: string; amount: number; payment_sessions?: { id: string }[] }
}

/** axios error มี circular reference ทำให้ jest worker crash → ห่อเป็น Error ธรรมดา */
const plain = (e: { response?: { status?: number; data?: unknown }; message?: string }): never => {
  throw new Error(`${e.response?.status ?? e.message} ${JSON.stringify(e.response?.data)}`)
}

// EV-15 (spec 02 กฎข้อ 31, AC-45; ADR-021): Medusa 2.22.1 ไม่ลบ shipping method เมื่อ cart เหลือ method เดียว
// hook beforeRefreshingPaymentCollection ลบ method ที่ค้างบน cart ที่เหลือแต่ line requires_shipping=false
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: ReturnType<typeof storeHeadersFor>
    let regionId: string
    let voucherVariantId: string
    let shirtVariantId: string
    let standardOptionId: string
    let digitalOptionId: string

    // runner reset DB ก่อนทุก test จึงสร้างทุกอย่างใน beforeEach
    beforeEach(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })
      const publishableKey = await getPublishableKey(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id"],
        filters: { name: "Default Sales Channel" },
      })
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      const { data: shirts } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "t-shirt" },
      })
      shirtVariantId = shirts[0].variants[0].id
      const { data: standard } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: "standard" } },
      })
      standardOptionId = standard[0].id
      const { data: digital } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: "digital-delivery" } },
      })
      digitalOptionId = digital[0].id

      // product ไม่มี shipping profile (กฎข้อ 1) → line requires_shipping=false
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "EV-15 voucher",
              status: "published",
              sales_channels: [{ id: channels[0].id }],
              options: [{ title: "Value", values: ["500"] }],
              variants: [
                {
                  title: "500 THB",
                  options: { Value: "500" },
                  manage_inventory: true,
                  prices: [{ currency_code: "thb", amount: VOUCHER_PRICE }],
                },
              ],
            },
          ],
        },
      })
      voucherVariantId = result[0].variants[0].id
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: voucherVariantId },
      })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: variants[0].inventory_items![0]!.inventory_item_id,
              location_id: locations[0].id,
              stocked_quantity: 20,
            },
          ],
        },
      })

      const { data: login } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      const admin = { headers: { authorization: `Bearer ${login.token}` } }
      const { data: partner } = await api.post("/admin/evoucher/partners", { name: "Lotus" }, admin)
      await api.post(
        "/admin/evoucher/pools",
        { partner_id: partner.partner.id, variant_id: voucherVariantId, name: "Lotus 500", how_to_use: "แสดง code" },
        admin
      )

      const { token } = await registerCustomer(api, publishableKey, BUYER_EMAIL, "ev15-pass")
      headers = storeHeadersFor(publishableKey, token)
    })

    const post = async <T = Cart>(url: string, body: unknown = {}, key = "cart"): Promise<T> => {
      const { data } = await api.post(url, body, headers).catch(plain)
      return data[key]
    }
    const addLine = (cartId: string, variantId: string, quantity = 1) =>
      post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity })
    const selectOption = (cartId: string, optionId: string) =>
      post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionId })
    const deleteLine = async (cartId: string, lineId: string): Promise<Cart> => {
      const { data } = await api.delete(`/store/carts/${cartId}/line-items/${lineId}`, headers).catch(plain)
      return data.parent
    }
    const getCart = async (cartId: string, fields = ""): Promise<Cart> => {
      const { data } = await api.get(`/store/carts/${cartId}${fields}`, headers).catch(plain)
      return data.cart
    }
    const newCart = async (...variantIds: string[]): Promise<Cart> => {
      const { data } = await api
        .post("/store/carts", { region_id: regionId, email: BUYER_EMAIL, shipping_address: ADDRESS, billing_address: ADDRESS }, headers)
        .catch(plain)
      let cart: Cart = data.cart
      for (const variantId of variantIds) {
        cart = await addLine(cart.id, variantId)
      }
      return cart
    }
    const lineOf = (cart: Cart, variantId: string) => cart.items.find((i) => i.variant_id === variantId)!
    const startPayment = async (cartId: string) => {
      const pc = await post<{ id: string }>("/store/payment-collections", { cart_id: cartId }, "payment_collection")
      await post(`/store/payment-collections/${pc.id}/payment-sessions`, { provider_id: "pp_system_default" }, "payment_collection")
      return pc.id
    }

    /** cart voucher + เสื้อ เลือก Standard แล้วลบเสื้อ */
    const voucherAfterRemovingShirt = async () => {
      const cart = await newCart(voucherVariantId, shirtVariantId)
      const selected = await selectOption(cart.id, standardOptionId)
      expect(selected.shipping_methods).toHaveLength(1)
      return { cartId: cart.id, shirtLineId: lineOf(selected, shirtVariantId).id }
    }

    it("ลบสินค้าจัดส่ง เหลือ voucher → ไม่มี method, shipping_total 0, total 500 และ order ไม่มีค่าส่ง", async () => {
      const { cartId, shirtLineId } = await voucherAfterRemovingShirt()

      const cart = await deleteLine(cartId, shirtLineId)

      expect(cart.shipping_methods).toEqual([])
      expect(cart.shipping_total).toBe(0)
      expect(cart.total).toBe(VOUCHER_PRICE)

      await startPayment(cartId)
      const { data: done } = await api.post(`/store/carts/${cartId}/complete`, {}, headers).catch(plain)
      expect(done.type).toBe("order")
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: ["id", "total", "shipping_methods.id"],
        filters: { id: done.order.id },
      })
      expect(order.shipping_methods).toEqual([])
      // BigNumber ของ Query เป็นคนละ class กับ MathBN ใน registry ของ jest → แปลงผ่าน JSON ก่อน
      expect(MathBN.eq(MathBN.convert(JSON.parse(JSON.stringify(order.total))), VOUCHER_PRICE)).toBe(true)
    })

    it("cart ที่มี payment collection ก่อนลบ → amount 500 และ session เดิมถูกล้าง", async () => {
      const { cartId, shirtLineId } = await voucherAfterRemovingShirt()
      await startPayment(cartId)
      const before = await getCart(cartId, "?fields=*payment_collection,*payment_collection.payment_sessions")
      expect(before.payment_collection!.payment_sessions).toHaveLength(1)

      await deleteLine(cartId, shirtLineId)

      const after = await getCart(cartId, "?fields=*payment_collection,*payment_collection.payment_sessions")
      expect(after.payment_collection!.amount).toBe(VOUCHER_PRICE)
      expect(after.payment_collection!.payment_sessions).toEqual([])
    })

    it("cart voucher ล้วนที่มี method digital-delivery → แก้จำนวน line แล้วยังมี method นั้น 1 ตัว", async () => {
      const cart = await newCart(voucherVariantId)
      await selectOption(cart.id, digitalOptionId)

      const updated = await post(`/store/carts/${cart.id}/line-items/${lineOf(cart, voucherVariantId).id}`, { quantity: 2 })

      expect(updated.shipping_methods.map((m) => m.shipping_option_id)).toEqual([digitalOptionId])
      expect(updated.shipping_total).toBe(0)
    })

    it("cart ผสมที่ method Standard → ลบเฉพาะ voucher แล้ว method ยังอยู่ และ total ลดเฉพาะราคา voucher", async () => {
      const cart = await newCart(voucherVariantId, shirtVariantId)
      const selected = await selectOption(cart.id, standardOptionId)

      const after = await deleteLine(cart.id, lineOf(selected, voucherVariantId).id)

      expect(after.shipping_methods.map((m) => m.shipping_option_id)).toEqual([standardOptionId])
      expect(after.total).toBe(selected.total - VOUCHER_PRICE)
    })

    it("cart voucher ล้วน POST shipping-methods ด้วย Standard → 200 และ method อยู่ใน cart", async () => {
      const cart = await newCart(voucherVariantId)

      const selected = await selectOption(cart.id, standardOptionId)

      expect(selected.shipping_methods.map((m) => m.shipping_option_id)).toEqual([standardOptionId])
      const refetched = await getCart(cart.id)
      expect(refetched.shipping_methods).toHaveLength(1)
    })

    // ข้อจำกัดของกฎข้อ 31b: refresh ถัดจากการเพิ่ม method ลบ Standard เงียบๆ (ADR-021)
    it.each<[string, (cart: Cart) => Promise<Cart>]>([
      ["แก้จำนวน line", (cart) => post(`/store/carts/${cart.id}/line-items/${lineOf(cart, voucherVariantId).id}`, { quantity: 2 })],
      ["เพิ่ม voucher", (cart) => addLine(cart.id, voucherVariantId)],
      ["แก้ cart (email)", (cart) => post(`/store/carts/${cart.id}`, { email: "ev15-other@example.com" })],
    ])("cart voucher ล้วนที่มี Standard เมื่อ%s → Standard ถูกลบ, shipping_total 0", async (_case, act) => {
      const cart = await newCart(voucherVariantId)
      const selected = await selectOption(cart.id, standardOptionId)
      expect(selected.shipping_methods).toHaveLength(1)

      const updated = await act(selected)

      expect(updated.shipping_methods).toEqual([])
      expect(updated.shipping_total).toBe(0)
    })

    it("cart ที่มีแต่สินค้าจัดส่ง ลบ line สุดท้าย → method ไม่ถูกแตะ", async () => {
      const cart = await newCart(shirtVariantId)
      const selected = await selectOption(cart.id, standardOptionId)

      const after = await deleteLine(cart.id, lineOf(selected, shirtVariantId).id)

      expect(after.items).toEqual([])
      expect(after.shipping_methods.map((m) => m.shipping_option_id)).toEqual([standardOptionId])
    })
  },
})
