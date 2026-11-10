import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN, Modules, PaymentActions, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { createGroupBuyCampaignWorkflow, type CreateGroupBuyCampaignInput } from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { GROUP_BUY_GROUP_SUCCEEDED } from "../../src/workflows/group-buy/join-group"
import { attributeAffiliateOrderWorkflow } from "../../src/workflows/affiliate/attribute-order"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"

// secret ของ token มาจาก env เท่านั้น (medusa-config → module option) — ตั้งก่อน runner โหลด config
process.env.AFFILIATE_TOKEN_SECRET = "af16-integration-secret"

jest.setTimeout(240 * 1000)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// mock provider ของ Medusa (seed เปิดใน region) — ไม่ออก network
const PROVIDER = "pp_system_default"

// ห่อ error ของ axios เป็น Error ธรรมดา (object ของ axios serialize ไม่ได้ → jest worker crash)
const plain = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn()
  } catch (e) {
    const res = (e as { response?: { status?: number; data?: unknown } }).response
    throw new Error(res ? `${res.status} ${JSON.stringify(res.data)}` : (e as Error).message)
  }
}

// AF-16 (spec 05 กฎ 41, AC-48): order ของ group buy ได้ค่าคอม affiliate — token จาก cart ลง metadata ของ draft order
// ตอน join, attribution ข้าม draft และอ่าน order.metadata หลังแปลง (GB-5)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productId: string
    let variantId: string
    let seq = 0

    beforeAll(async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      regionId = (await query.graph({ entity: "region", fields: ["id"] })).data[0].id
      const { data: keys } = await query.graph({
        entity: "api_key",
        fields: ["sales_channels.id"],
        filters: { token: pk },
      })
      // ราคา THB รวม VAT 7% (seed) → 1,070 = ฿1,000 ไม่รวมภาษี; GB −30% → ฐานค่าคอม ฿700
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "AF-16 product",
              handle: "af16-product",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Size", values: ["One"] }],
              variants: [
                {
                  title: "One",
                  options: { Size: "One" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1070 }],
                },
              ],
              sales_channels: [{ id: (keys[0] as any).sales_channels[0].id }],
            },
          ],
        },
      })
      productId = result[0].id
      variantId = result[0].variants[0].id
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const affiliates = (): AffiliateModuleService => getContainer().resolve(AFFILIATE_MODULE)
    const eventBus = () => getContainer().resolve(Modules.EVENT_BUS)

    let ann: { id: string; email: string }
    let program: { id: string }

    beforeEach(async () => {
      seq += 1
      ann = await affiliates().createAffiliates({
        email: `af16-ann-${seq}@example.com`,
        name: "Ann",
        code: `ann${seq}`,
        status: "active",
      })
      program = await affiliates().createAffiliatePrograms({
        name: "P",
        status: "published",
        starts_at: new Date(Date.now() - DAY),
        ends_at: new Date(Date.now() + DAY),
        commission_type: "percentage",
        commission_value: 10,
        scope: { all: true },
        attribution_window_days: 7,
        hold_days: 14,
      })
    })

    const tokenOfAnn = () => affiliates().signClickToken(ann.id, new Date(Date.now() - 60 * 1000))

    // กลุ่ม pool เป้า 1 คน: A join ด้วย cart ที่มี metadata ตามที่ส่ง → กลุ่มสำเร็จ (GB-4 สร้าง payment collection)
    async function joinAs(email: string, metadata?: Record<string, unknown>) {
      const { result: campaign } = await createGroupBuyCampaignWorkflow(getContainer()).run({
        input: {
          name: "AF-16",
          target_type: "orders",
          target_value: 1,
          group_mode: "pool",
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 30,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
          },
          rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
        } as CreateGroupBuyCampaignInput,
      })
      await setGroupBuyCampaignStatusWorkflow(getContainer()).run({ input: { id: campaign.id, status: "active" } })
      const { result: group } = await createGroupWorkflow(getContainer()).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      })
      const { token } = await plain(() => registerCustomer(api, pk, email, "af16-password"))
      const headers = storeHeadersFor(pk, token)
      const { data: cart } = await plain<{ data: any }>(() =>
        api.post(
          "/store/carts",
          { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }], metadata },
          headers
        )
      )
      const succeeded = TestEventUtils.waitSubscribersExecution(GROUP_BUY_GROUP_SUCCEEDED, eventBus())
      const { data: res } = await plain<{ data: any }>(() =>
        api.post(`/store/group-buy/groups/${group.join_token}/join`, { cart_id: cart.cart.id }, headers)
      )
      await succeeded
      return {
        headers,
        cart_id: cart.cart.id as string,
        order_id: res.membership.order_id as string,
        membership_id: res.membership.id as string,
      }
    }

    const orderOf = async (id: string) => {
      const { data } = await query().graph({
        entity: "order",
        fields: [
          "id",
          "email",
          "is_draft_order",
          "created_at",
          "metadata",
          "subtotal",
          "items.id",
          "items.subtotal",
          "items.discount_subtotal",
          "payment_collections.id",
        ],
        filters: { id },
      })
      return data[0] as any
    }

    // สมาชิกชำระผ่าน store route ของ Medusa แล้ว provider แจ้ง captured → GB-5 แปลง draft order (emit order.placed)
    async function payAndConvert(member: { headers: { headers: Record<string, string> }; order_id: string }) {
      const collection = (await orderOf(member.order_id)).payment_collections[0]
      const { data } = await plain<{ data: any }>(() =>
        api.post(`/store/payment-collections/${collection.id}/payment-sessions`, { provider_id: PROVIDER }, member.headers)
      )
      const session = data.payment_collection.payment_sessions[0]
      const placed = TestEventUtils.waitSubscribersExecution("order.placed", eventBus())
      await processPaymentWorkflow(getContainer()).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount } },
      })
      await placed
    }

    const attributionsOf = (orderId: string) => affiliates().listAffiliateAttributions({ order_id: orderId })
    const entriesOf = (orderId: string) => affiliates().listAffiliateCommissionEntries({ order_id: orderId })

    it("AC-48: join copies the cart affiliate_token to the draft order; no attribution on the draft; one attribution + 10% entry after conversion", async () => {
      const token = await tokenOfAnn()
      const member = await joinAs(`af16-a-${seq}@example.com`, { affiliate_token: token })

      const draft = await orderOf(member.order_id)
      expect(draft.is_draft_order).toBe(true)
      expect(draft.metadata).toEqual(
        expect.objectContaining({ affiliate_token: token, group_buy_membership_id: member.membership_id })
      )

      // กฎ 41c: attribution กับ draft order → หยุดเงียบ ไม่บันทึกอะไร
      await attributeAffiliateOrderWorkflow(getContainer()).run({ input: { order_id: member.order_id } })
      expect(await attributionsOf(member.order_id)).toHaveLength(0)
      expect(await entriesOf(member.order_id)).toHaveLength(0)

      await payAndConvert(member)

      const placed = await orderOf(member.order_id)
      expect(placed.is_draft_order).toBe(false)
      // กฎ 41d: การแปลงไม่สร้าง order ใหม่ → created_at (เวลาอ้างอิงกฎ 24) = เวลาที่ join
      expect(new Date(placed.created_at).getTime()).toEqual(new Date(draft.created_at).getTime())

      const attributions = await attributionsOf(member.order_id)
      expect(attributions).toHaveLength(1)
      expect(attributions[0]).toEqual(expect.objectContaining({ affiliate_id: ann.id, program_id: program.id }))

      const entries = await entriesOf(member.order_id)
      expect(entries).toHaveLength(1)
      const [item] = placed.items
      expect(entries[0]).toEqual(
        expect.objectContaining({ affiliate_id: ann.id, line_item_id: item.id, status: "pending" })
      )
      // ฐาน = subtotal − discount_subtotal ของ line หลังส่วนลด GB-* (กฎ 3) = ฿700 → 10% = ฿70
      const base = MathBN.sub(item.subtotal, item.discount_subtotal)
      expect(MathBN.eq(entries[0].amount, MathBN.mult(base, 0.1))).toBe(true)
      expect(MathBN.eq(entries[0].amount, 70)).toBe(true)
    })

    it.each([
      ["no metadata", undefined],
      ["empty affiliate_token", { affiliate_token: "" }],
    ])("AC-48: cart with %s → draft order has no affiliate_token key and no attribution after conversion", async (_, metadata) => {
      const member = await joinAs(`af16-none-${seq}@example.com`, metadata)

      const draft = await orderOf(member.order_id)
      expect(draft.metadata).toEqual(expect.objectContaining({ group_buy_membership_id: member.membership_id }))
      expect(Object.keys(draft.metadata)).not.toContain("affiliate_token")

      await payAndConvert(member)

      expect((await orderOf(member.order_id)).is_draft_order).toBe(false)
      expect(await attributionsOf(member.order_id)).toHaveLength(0)
      expect(await entriesOf(member.order_id)).toHaveLength(0)
    })

    // AF-17 (กฎ 41b, AC-49): cart ที่ link กับ order มี affiliate_token = "" → ถือว่าไม่มี แล้วอ่าน token ของ draft order
    it("AC-49: converted order whose cart has affiliate_token '' falls back to the draft order token → one attribution of Ann", async () => {
      const token = await tokenOfAnn()
      const member = await joinAs(`af17-empty-${seq}@example.com`, { affiliate_token: "" })

      // จำลอง order ที่มี cart (link order ↔ cart ของ Medusa) ซึ่ง metadata.affiliate_token = "" และ draft order มี token
      // ของ Ann (update metadata ของ Medusa ลบ key ที่ค่าเป็น "" จึงสร้าง cart ด้วย "" แล้วใส่ token ที่ draft order แทน)
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(member.order_id, { metadata: { affiliate_token: token } })
      await getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({ [Modules.ORDER]: { order_id: member.order_id }, [Modules.CART]: { cart_id: member.cart_id } })
      const { data: linked } = await query().graph({
        entity: "order",
        fields: ["cart.metadata"],
        filters: { id: member.order_id },
      })
      expect((linked[0] as any).cart.metadata).toEqual(expect.objectContaining({ affiliate_token: "" }))
      expect((await orderOf(member.order_id)).metadata).toEqual(expect.objectContaining({ affiliate_token: token }))

      await payAndConvert(member)

      expect((await orderOf(member.order_id)).is_draft_order).toBe(false)
      const attributions = await attributionsOf(member.order_id)
      expect(attributions).toHaveLength(1)
      expect(attributions[0]).toEqual(expect.objectContaining({ affiliate_id: ann.id, program_id: program.id }))
    })

    it("AC-48 (กฎ 12): Ann's token on an order whose email is Ann's → no entry", async () => {
      const token = await tokenOfAnn()
      const member = await joinAs(ann.email, { affiliate_token: token })
      expect((await orderOf(member.order_id)).email).toEqual(ann.email)

      await payAndConvert(member)

      expect((await orderOf(member.order_id)).is_draft_order).toBe(false)
      // token อ่านจาก order.metadata ได้ (attribution เกิด) แต่ซื้อเอง → ไม่มี entry
      expect(await attributionsOf(member.order_id)).toHaveLength(1)
      expect(await entriesOf(member.order_id)).toHaveLength(0)
    })
  },
})
