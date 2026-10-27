import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN, Modules, PaymentActions, ProductStatus } from "@medusajs/framework/utils"
import type { OrderDetailDTO } from "@medusajs/framework/types"
import { createProductsWorkflow, getLastPaymentStatus, processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { createGroupBuyCampaignWorkflow, type CreateGroupBuyCampaignInput } from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { GROUP_BUY_GROUP_SUCCEEDED } from "../../src/workflows/group-buy/join-group"
import groupBuyDeadlineJob from "../../src/jobs/group-buy-deadline"
import { confirmGroupBuyMembershipPaymentWorkflow } from "../../src/workflows/group-buy/membership-payment"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"

jest.setTimeout(240 * 1000)

const HOUR = 60 * 60 * 1000
// mock provider ของ Medusa (seed เปิดใน region) — ไม่ออก network
const PROVIDER = "pp_system_default"

// GB-5: payment.captured → membership paid + แปลง draft order (AC-2 ส่วน API, AC-37) และหมดเวลาชำระเงิน (AC-10)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productXId: string
    let variantX: string
    let variantOdd: string
    let variantStocked: string

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
      // fixture ของ review #100: ฿1,000 −30% → order.total = 699.9999999999999999999983 (raw precision 20 เก็บเป็น 700)
      // และ ฿1,000.07 −30% → 700.049 ที่ raw ยังมี 3 ตำแหน่ง (พิสูจน์การปัดของกฎข้อ 20 จริง)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "GB-5 product X",
              handle: "gb5-product-x",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Size", values: ["One", "Odd", "Stocked"] }],
              variants: [
                {
                  title: "One",
                  options: { Size: "One" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
                {
                  title: "Odd",
                  options: { Size: "Odd" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 1000.07 }],
                },
                {
                  title: "Stocked",
                  options: { Size: "Stocked" },
                  manage_inventory: true,
                  prices: [{ currency_code: "thb", amount: 1000 }],
                },
              ],
              sales_channels: [{ id: (keys[0] as any).sales_channels[0].id }],
            },
          ],
        },
      })
      productXId = result[0].id
      variantX = result[0].variants.find((v) => v.title === "One")!.id
      variantOdd = result[0].variants.find((v) => v.title === "Odd")!.id
      variantStocked = result[0].variants.find((v) => v.title === "Stocked")!.id
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const groupBuy = (): GroupBuyModuleService => getContainer().resolve(GROUP_BUY_MODULE)
    const eventBus = () => getContainer().resolve(Modules.EVENT_BUS)

    // กลุ่ม pool ที่ถึงเป้า (target = จำนวนสมาชิก) ผ่าน store route → GB-4 สร้าง payment collection
    async function succeededGroup(
      members: number,
      data: Partial<CreateGroupBuyCampaignInput> = {},
      variantId = variantX
    ) {
      const { result: campaign } = await createGroupBuyCampaignWorkflow(getContainer()).run({
        input: {
          name: "GB-5 payment",
          target_type: "orders",
          target_value: members,
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
          ...data,
        } as CreateGroupBuyCampaignInput,
      })
      await setGroupBuyCampaignStatusWorkflow(getContainer()).run({ input: { id: campaign.id, status: "active" } })
      const { result: group } = await createGroupWorkflow(getContainer()).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      })
      const joined: { headers: { headers: Record<string, string> }; order_id: string; membership_id: string }[] = []
      for (let i = 0; i < members; i++) {
        const { token } = await registerCustomer(api, pk, `gb5+${Date.now()}${i}@example.com`, "gb5-password")
        const headers = storeHeadersFor(pk, token)
        const { data: cart } = await api.post(
          "/store/carts",
          { region_id: regionId, items: [{ variant_id: variantId, quantity: 1 }] },
          headers
        )
        const succeeded =
          i === members - 1 ? TestEventUtils.waitSubscribersExecution(GROUP_BUY_GROUP_SUCCEEDED, eventBus()) : null
        const { data: res } = await api.post(
          `/store/group-buy/groups/${group.join_token}/join`,
          { cart_id: cart.cart.id },
          headers
        )
        await succeeded
        joined.push({ headers, order_id: res.membership.order_id, membership_id: res.membership.id })
      }
      return { group, joined }
    }

    // payment_status ไม่ใช่ column — คำนวณด้วย helper เดียวกับ route order ของ Medusa (แบบ GB-6c)
    const orderOf = async (id: string) => {
      const { data } = await query().graph({
        entity: "order",
        fields: ["id", "status", "is_draft_order", "total", "summary.*", "payment_collections.*"],
        filters: { id },
      })
      const order = data[0] as any
      return { ...order, payment_status: getLastPaymentStatus(order as OrderDetailDTO) }
    }

    const membershipOf = async (id: string) => (await groupBuy().listGroupBuyMemberships({ id }))[0]

    // สมาชิกสร้าง session ผ่าน store route ของ Medusa (spec 04 กฎข้อ 22) แล้ว provider แจ้ง captured (เหมือน webhook)
    async function pay(
      member: { headers: { headers: Record<string, string> }; order_id: string },
      events = ["payment.captured", "order.placed"]
    ) {
      const collection = (await orderOf(member.order_id)).payment_collections[0]
      const { data } = await api.post(
        `/store/payment-collections/${collection.id}/payment-sessions`,
        { provider_id: PROVIDER },
        member.headers
      )
      const session = data.payment_collection.payment_sessions[0]
      // order.placed มาจาก convertDraftOrderWorkflow ใน subscriber ของ payment.captured
      const settled = Promise.allSettled(events.map((e) => TestEventUtils.waitSubscribersExecution(e, eventBus())))
      await processPaymentWorkflow(getContainer()).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount } },
      })
      await settled
      return session
    }

    it.each([
      ["฿1,000 (review #100)", () => variantX, 700],
      ["฿1,000.07", () => variantOdd, 700.05],
    ])("AC-37 + AC-2 (API) %s: collection = order.total rounded to 2 dp; capture completes it, converts the draft order, membership paid", async (_, variant, expected) => {
      const { joined } = await succeededGroup(1, {}, variant())
      const [member] = joined
      const before = await orderOf(member.order_id)
      // raw_amount = ค่าที่เก็บจริง (amount ที่ Query คืนเป็น number ถูกปัดโดย JS แล้ว)
      const amount = before.payment_collections[0].raw_amount
      // กฎข้อ 20: total ดิบมีทศนิยมเกิน 2 ตำแหน่ง แต่ collection = ปัด half-up
      expect(MathBN.convert(before.total).decimalPlaces()).toBeGreaterThan(2)
      expect(MathBN.convert(amount).decimalPlaces()).toBeLessThanOrEqual(2)
      expect(MathBN.eq(amount, MathBN.convert(before.total, 2))).toBe(true)
      expect(MathBN.eq(amount, expected)).toBe(true)

      const session = await pay(member)
      expect(MathBN.eq(session.amount, expected)).toBe(true)

      const after = await orderOf(member.order_id)
      expect(after.payment_collections[0].status).toEqual("completed")
      expect(after.is_draft_order).toBe(false)
      expect(after.status).toEqual("pending")
      expect(after.payment_status).toEqual("captured")
      // เศษ < 0.005 ใน summary ไม่ทำให้สถานะผิด
      expect(MathBN.lt(MathBN.abs(after.summary.pending_difference), 0.005)).toBe(true)
      expect((await membershipOf(member.membership_id)).status).toEqual("paid")
    })

    it("payment.captured twice is idempotent: membership stays paid and the order is converted once", async () => {
      const { joined } = await succeededGroup(1)
      const [member] = joined
      const session = await pay(member)
      const placed = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template: "order-placed", resource_id: member.order_id })

      const { data: payments } = await query().graph({
        entity: "payment",
        fields: ["id"],
        filters: { payment_session_id: session.id },
      })
      const again = TestEventUtils.waitSubscribersExecution("payment.captured", eventBus())
      await eventBus().emit({ name: "payment.captured", data: { id: payments[0].id } })
      await again

      expect((await membershipOf(member.membership_id)).status).toEqual("paid")
      expect((await orderOf(member.order_id)).is_draft_order).toBe(false)
      expect(placed).toHaveLength(1)
      expect(
        await getContainer()
          .resolve(Modules.NOTIFICATION)
          .listNotifications({ template: "order-placed", resource_id: member.order_id })
      ).toHaveLength(1)
    })

    it("out of stock at convert: convertDraftOrderWorkflow fails → membership compensated back to awaiting_payment, order stays draft", async () => {
      const container = getContainer()
      const { data: variants } = await query().graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantStocked },
      })
      const { data: locations } = await query().graph({ entity: "stock_location", fields: ["id"] })
      const inventoryItemId = (variants[0] as any).inventory_items[0].inventory_item_id
      const inventory = container.resolve(Modules.INVENTORY)
      await inventory.createInventoryLevels(
        locations.map((l) => ({ inventory_item_id: inventoryItemId, location_id: l.id, stocked_quantity: 1 }))
      )
      const { joined } = await succeededGroup(1, {}, variantStocked)
      const [member] = joined
      // สต็อกหมดระหว่างรอชำระ (draft order ไม่จอง inventory — กฎข้อ 6)
      await inventory.updateInventoryLevels(
        locations.map((l) => ({ inventory_item_id: inventoryItemId, location_id: l.id, stocked_quantity: 0 }))
      )

      await pay(member, ["payment.captured"])
      const { errors } = await confirmGroupBuyMembershipPaymentWorkflow(container).run({
        input: { membership_id: member.membership_id },
        throwOnError: false,
      })

      expect(errors[0]?.error?.message).toMatch(/Not enough stock/)
      expect((await membershipOf(member.membership_id)).status).toEqual("awaiting_payment")
      const order = await orderOf(member.order_id)
      expect(order.is_draft_order).toBe(true)
      expect(order.payment_collections[0].status).toEqual("completed")
    })

    it("AC-10: pay_within_hours=1 — after the deadline the job cancels the unpaid member's order with a 'payment expired' email; the paid member is untouched", async () => {
      const { group, joined } = await succeededGroup(2, { pay_within_hours: 1 })
      const [paid, unpaid] = joined
      const g = (await groupBuy().listGroupBuyGroups({ id: group.id }))[0]
      expect(new Date(g.pay_deadline_at!).getTime() - new Date(g.succeeded_at!).getTime()).toEqual(HOUR)
      await pay(paid)

      // ยังไม่ถึงกำหนด → job ไม่แตะ
      await groupBuyDeadlineJob(getContainer())
      expect((await membershipOf(unpaid.membership_id)).status).toEqual("awaiting_payment")

      // 1 ชม. ผ่านไป
      await groupBuy().updateGroupBuyGroups({ id: group.id, pay_deadline_at: new Date(Date.now() - 1000) })
      await groupBuyDeadlineJob(getContainer())
      await groupBuyDeadlineJob(getContainer())

      expect((await membershipOf(unpaid.membership_id)).status).toEqual("cancelled")
      const cancelled = await orderOf(unpaid.order_id)
      expect(cancelled.status).toEqual("canceled")
      expect(cancelled.payment_collections[0].status).toEqual("canceled")
      const emails = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template: "group-buy-payment-expired", channel: "email" })
      expect(emails.map((n) => n.resource_id)).toEqual([unpaid.order_id])

      expect((await membershipOf(paid.membership_id)).status).toEqual("paid")
      const kept = await orderOf(paid.order_id)
      expect(kept.status).toEqual("pending")
      expect(kept.is_draft_order).toBe(false)
      expect(kept.payment_status).toEqual("captured")
    })
  },
})
