import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(180 * 1000)

process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev7c-admin@example.com"
const ADMIN_PASSWORD = "ev7c-test-password"

// EV-7c (spec 02 กฎข้อ 24, AC-37 ส่วน integration): cart ที่มีแต่ voucher ตั้งที่อยู่ใบกำกับภาษีเป็น shipping_address
// แล้ว complete โดยไม่มี shipping method → order มี VAT 7% แบบรวมในราคา (Tax module ของ Medusa — โค้ดเราไม่คำนวณภาษี)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let publishableKey: string
    let regionId: string
    let variantId: string

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })
      publishableKey = await getPublishableKey(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id"],
        filters: { name: "Default Sales Channel" },
      })
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })

      // product ไม่มี shipping profile (กฎข้อ 1) + pool → inventory item requires_shipping=false
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "EV-7c voucher",
              status: "published",
              sales_channels: [{ id: channels[0].id }],
              options: [{ title: "Value", values: ["500"] }],
              variants: [
                {
                  title: "500 THB",
                  options: { Value: "500" },
                  manage_inventory: true,
                  prices: [{ currency_code: "thb", amount: 500 }],
                },
              ],
            },
          ],
        },
      })
      variantId = result[0].variants[0].id
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: variants[0].inventory_items![0]!.inventory_item_id,
              location_id: locations[0].id,
              stocked_quantity: 5,
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
        {
          partner_id: partner.partner.id,
          variant_id: variantId,
          name: "Lotus 500",
          how_to_use: "แสดง code",
        },
        admin
      )
    })

    it("AC-37: ที่อยู่ใบกำกับภาษีเป็น shipping_address, ไม่มี shipping method → order มี tax_total = total × 7/107", async () => {
      const { token } = await registerCustomer(api, publishableKey, "ev7c-buyer@example.com", "ev7c-pass")
      const headers = storeHeadersFor(publishableKey, token)
      const address = {
        first_name: "สมชาย",
        last_name: "ใจดี",
        address_1: "99 ถนนสุขุมวิท",
        city: "วัฒนา",
        postal_code: "10110",
        country_code: "th",
      }

      const { data: created } = await api.post("/store/carts", { region_id: regionId }, headers)
      const cartId = created.cart.id
      const { data: added } = await api.post(
        `/store/carts/${cartId}/line-items?fields=+items.requires_shipping`,
        { variant_id: variantId, quantity: 2 },
        headers
      )
      expect(added.cart.items.map((i: { requires_shipping: boolean }) => i.requires_shipping)).toEqual([
        false,
      ])
      // กฎข้อ 24b: storefront ส่งที่อยู่เดียวกันเป็นทั้ง billing และ shipping
      await api.post(
        `/store/carts/${cartId}`,
        { email: "ev7c-buyer@example.com", billing_address: address, shipping_address: address },
        headers
      )
      const { data: pc } = await api.post(
        "/store/payment-collections",
        { cart_id: cartId },
        headers
      )
      await api.post(
        `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        headers
      )

      const { data: done } = await api.post(`/store/carts/${cartId}/complete`, {}, headers)

      expect(done.type).toBe("order")
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: ["id", "total", "tax_total", "shipping_methods.id", "shipping_address.*"],
        filters: { id: done.order.id },
      })
      expect(order.shipping_methods).toEqual([])
      expect(order.shipping_address).toMatchObject({
        address_1: address.address_1,
        postal_code: address.postal_code,
        country_code: address.country_code,
      })
      // BigNumber ของ Query เป็นคนละ class กับ MathBN ใน registry ของ jest → แปลงผ่าน JSON ก่อน
      const total = MathBN.convert(JSON.parse(JSON.stringify(order.total)))
      const taxTotal = MathBN.convert(JSON.parse(JSON.stringify(order.tax_total)))
      expect(MathBN.gt(taxTotal, 0)).toBe(true)
      const expected = MathBN.div(MathBN.mult(total, 7), 107)
      expect(MathBN.lte(MathBN.abs(MathBN.sub(taxTotal, expected)), 0.01)).toBe(true)
    })
  },
})
