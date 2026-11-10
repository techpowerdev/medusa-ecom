import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN, ProductStatus } from "@medusajs/framework/utils"
import {
  createOrUpdateOrderPaymentCollectionWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"

jest.setTimeout(240 * 1000)

const ADMIN_EMAIL = "gb3c-admin@example.com"
const ADMIN_PASSWORD = "gb3c-password"
const HOUR = 60 * 60 * 1000

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} to be present`)
  }
  return value
}

// เทียบจำนวนเงินด้วย MathBN (ไม่ใช่ float) ที่ทศนิยมของ THB (2 ตำแหน่ง) — ส่วนลด % ของ Medusa ให้ raw เช่น
// 699.9999999999999999999983 จึงปัดที่ความละเอียดของสกุลเงินก่อนเทียบ
const THB_DECIMALS = 2
const expectAmount = (actual: unknown, expected: number) =>
  expect(MathBN.convert(actual as any, THB_DECIMALS).toFixed()).toEqual(
    MathBN.convert(expected, THB_DECIMALS).toFixed()
  )

// GB-3c: summary ของ draft order หลัง join ต้องตรงกับยอดหลังส่วนลด GB-<token> (spec 04 กฎข้อ 18, AC-36)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productXId: string
    let variantX: string
    let admin: { headers: Record<string, string> }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: keys } = await query.graph({
        entity: "api_key",
        fields: ["sales_channels.id"],
        filters: { token: pk },
      })
      const salesChannelId = must((keys[0] as any)?.sales_channels?.[0]?.id, "sales channel") as string

      // product X ราคา ฿1,000 (AC-36)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "GB-3c product X",
              handle: "gb3c-product-x",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  options: { Size: "One" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
              ],
              sales_channels: [{ id: salesChannelId }],
            },
          ],
        },
      })
      productXId = result[0].id
      variantX = must(result[0].variants?.[0]?.id, "variant X")
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      admin = { headers: { authorization: `Bearer ${data.token}` } }
    })

    const createCampaign = async () => {
      const container = getContainer()
      const { result } = await createGroupBuyCampaignWorkflow(container).run({
        input: {
          name: "GB-3c summary",
          target_type: "orders",
          target_value: 100,
          group_mode: "pool",
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 30,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productXId] }],
          },
          rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
        } as CreateGroupBuyCampaignInput,
      })
      await setGroupBuyCampaignStatusWorkflow(container).run({
        input: { id: result.id, status: "active" },
      })
      return result
    }

    it("AC-36: draft order summary after join equals the discounted total (700 of ฿1,000)", async () => {
      const campaign = await createCampaign()
      const { result: group } = await createGroupWorkflow(getContainer()).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      })
      const email = `gb3c+${Date.now()}@example.com`
      const { token } = await registerCustomer(api, pk, email, "gb3c-password")
      const headers = storeHeadersFor(pk, token)
      const { data: cartRes } = await api.post(
        "/store/carts",
        { region_id: regionId, items: [{ variant_id: variantX, quantity: 1 }] },
        headers
      )
      const { data: joined } = await api.post(
        `/store/group-buy/groups/${group.join_token}/join`,
        { cart_id: cartRes.cart.id },
        headers
      )
      const orderId = joined.membership.order_id as string

      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "total", "summary.*", "items.adjustments.code"],
        filters: { id: orderId },
      })
      const order = must(orders[0], "draft order") as any
      expect(order.items.flatMap((i: any) => i.adjustments.map((a: any) => a.code))).toEqual([
        `GB-${group.join_token}`,
      ])
      expectAmount(order.total, 700)
      expectAmount(order.summary.current_order_total, 700)
      expectAmount(order.summary.pending_difference, 700)

      // admin API ของ Medusa คืน summary ชุดเดียวกัน
      const { data: adminRes } = await api.get(`/admin/orders/${orderId}?fields=id,total,summary`, admin)
      expectAmount(adminRes.order.total, 700)
      expectAmount(adminRes.order.summary.current_order_total, 700)
      expectAmount(adminRes.order.summary.pending_difference, 700)

      // payment collection ที่ Medusa สร้างจาก summary โดยไม่ระบุ amount
      const { result: collections } = await createOrUpdateOrderPaymentCollectionWorkflow(getContainer()).run({
        input: { order_id: orderId },
      })
      const collection = must((collections as any[])?.[0], "payment collection")
      expectAmount(collection.amount, 700)
    })
  },
})
