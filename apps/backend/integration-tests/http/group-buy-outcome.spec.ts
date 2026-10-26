import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { GROUP_BUY_GROUP_SUCCEEDED, joinGroupWorkflow } from "../../src/workflows/group-buy/join-group"
import { failGroupWorkflow, succeedGroupWorkflow } from "../../src/workflows/group-buy/group-outcome"
import groupBuyDeadlineJob from "../../src/jobs/group-buy-deadline"
import { renderEmailTemplate } from "../../src/modules/resend/templates"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"

jest.setTimeout(240 * 1000)

const ADMIN_EMAIL = "gb-outcome-admin@example.com"
const ADMIN_PASSWORD = "gb-outcome-password"
const HOUR = 60 * 60 * 1000

type Res = { status: number; data: any }

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} to be present`)
  }
  return value
}

// error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้ จึงคืนเฉพาะ status/data
const settle = (request: Promise<{ status: number; data: any }>): Promise<Res> =>
  request.then(
    (r) => ({ status: r.status, data: r.data }),
    (e) => {
      if (!e?.response) {
        throw new Error(`request failed without response: ${e?.message}`)
      }
      return { status: e.response.status, data: e.response.data }
    }
  )

// GB-4: succeedGroupWorkflow / failGroupWorkflow + deadline job + admin succeed/fail (spec 04 AC-1, 3, 9, 11, 12, 22)
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
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "handle", "variants.id", "variants.title"],
      })
      const tshirt = must(
        products.find((p) => p.handle === "t-shirt"),
        "t-shirt"
      )
      productXId = tshirt.id
      variantX = must(
        tshirt.variants.find((v) => v?.title === "S"),
        "t-shirt S"
      ).id
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      admin = { headers: { authorization: `Bearer ${data.token}` } }
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const groupBuy = (): GroupBuyModuleService => getContainer().resolve(GROUP_BUY_MODULE)

    const createCampaign = async (data: Partial<CreateGroupBuyCampaignInput> = {}) => {
      const container = getContainer()
      const { result } = await createGroupBuyCampaignWorkflow(container).run({
        input: {
          name: "GB outcome",
          target_type: "orders",
          target_value: 3,
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
      await setGroupBuyCampaignStatusWorkflow(container).run({ input: { id: result.id, status: "active" } })
      return result
    }

    const poolGroup = async (campaignId: string) =>
      (await createGroupWorkflow(getContainer()).run({ input: { campaign_id: campaignId, kind: "pool" } }))
        .result

    // join ระดับ workflow (เร็วกว่า HTTP) — ลูกค้ามี email ให้ draft order ใช้ส่งอีเมล
    const customer = async () =>
      getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email: `gb4+${Date.now()}${Math.random()}@example.com`, has_account: true })

    const joinAs = async (joinToken: string, customerId: string, quantity = 1) => {
      const container = getContainer()
      const { result: cart } = await createCartWorkflow(container).run({
        input: { region_id: regionId, customer_id: customerId, items: [{ variant_id: variantX, quantity }] },
      })
      await joinGroupWorkflow(container).run({
        input: { join_token: joinToken, cart_id: cart.id, customer_id: customerId },
      })
    }

    const groupOf = async (id: string) =>
      must(
        (
          await query().graph({
            entity: "group_buy_group",
            fields: ["id", "status", "succeeded_at", "pay_deadline_at"],
            filters: { id },
          })
        ).data[0],
        `group ${id}`
      ) as any

    const membershipsOf = async (groupId: string) =>
      (
        await query().graph({
          entity: "group_buy_membership",
          fields: ["id", "status", "order_id"],
          filters: { group_id: groupId },
        })
      ).data as any[]

    const ordersOf = async (ids: string[]) =>
      (
        await query().graph({
          entity: "order",
          fields: [
            "id",
            "status",
            "is_draft_order",
            "total",
            "subtotal",
            "discount_total",
            "payment_collections.id",
            "payment_collections.amount",
            "payment_collections.currency_code",
          ],
          filters: { id: ids },
        })
      ).data as any[]

    const emails = async (template: string) =>
      getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template, channel: "email" })

    const expireGroup = (id: string) =>
      groupBuy().updateGroupBuyGroups({ id, ends_at: new Date(Date.now() - 1000) })

    describe("succeed (AC-1, AC-9)", () => {
      it("AC-1: 3 logged-in customers join pool P → succeeded, payment collection = discounted draft total, email with pay link", async () => {
        const campaign = await createCampaign({ target_type: "orders", target_value: 3 })
        const group = await poolGroup(campaign.id)
        const eventBus = getContainer().resolve(Modules.EVENT_BUS)

        for (let i = 0; i < 3; i++) {
          const email = `gb4-http+${Date.now()}${i}@example.com`
          const { token } = await registerCustomer(api, pk, email, "gb4-password")
          const headers = storeHeadersFor(pk, token)
          const cart = await settle(
            api.post(
              "/store/carts",
              { region_id: regionId, items: [{ variant_id: variantX, quantity: 1 }] },
              headers
            )
          )
          expect(cart.status).toEqual(200)
          const succeeded =
            i === 2 ? TestEventUtils.waitSubscribersExecution(GROUP_BUY_GROUP_SUCCEEDED, eventBus) : null
          const res = await settle(
            api.post(
              `/store/group-buy/groups/${group.join_token}/join`,
              { cart_id: cart.data.cart.id },
              headers
            )
          )
          expect(res.status).toEqual(201)
          await succeeded
        }

        const g = await groupOf(group.id)
        expect(g.status).toEqual("succeeded")
        expect(new Date(g.pay_deadline_at).getTime() - new Date(g.succeeded_at).getTime()).toEqual(24 * HOUR)

        const members = await membershipsOf(group.id)
        expect(members.map((m) => m.status)).toEqual([
          "awaiting_payment",
          "awaiting_payment",
          "awaiting_payment",
        ])
        const orders = await ordersOf(members.map((m) => m.order_id))
        expect(orders).toHaveLength(3)
        for (const order of orders) {
          expect(order.is_draft_order).toBe(true)
          expect(order.payment_collections).toHaveLength(1)
          // review #68: ยอดหลังส่วนลด GB-* ของ draft order ที่ Medusa คำนวณ — ไม่ใช่ยอดเต็ม
          expect(Number(order.discount_total)).toBeGreaterThan(0)
          expect(Number(order.payment_collections[0].amount)).toEqual(Number(order.total))
          expect(Number(order.payment_collections[0].amount)).toBeLessThan(Number(order.subtotal))
          expect(order.payment_collections[0].currency_code).toEqual("thb")
        }

        const sent = await emails("group-buy-succeeded")
        expect(sent).toHaveLength(3)
        expect(sent.map((n) => n.resource_id).sort()).toEqual(members.map((m) => m.order_id).sort())
        for (const n of sent) {
          expect(n.data).toEqual(
            expect.objectContaining({
              pay_url: expect.stringContaining(`/account/orders/${n.resource_id}/pay`),
            })
          )
          const rendered = must(renderEmailTemplate("group-buy-succeeded", n.data!), "rendered email")
          expect(rendered.html).toContain(`/account/orders/${n.resource_id}/pay`)
        }
      })

      it("AC-9: succeed twice (workflow + admin route) → no duplicate payment collections or emails", async () => {
        const campaign = await createCampaign({ target_value: 5 })
        const group = await poolGroup(campaign.id)
        await joinAs(group.join_token, (await customer()).id)
        await joinAs(group.join_token, (await customer()).id)

        await succeedGroupWorkflow(getContainer()).run({ input: { group_id: group.id } })
        const res = await settle(api.post(`/admin/group-buy/groups/${group.id}/succeed`, {}, admin))
        expect(res.status).toEqual(200)
        expect(res.data.group).toEqual(expect.objectContaining({ id: group.id, status: "succeeded" }))
        await succeedGroupWorkflow(getContainer()).run({ input: { group_id: group.id } })

        const members = await membershipsOf(group.id)
        const orders = await ordersOf(members.map((m) => m.order_id))
        expect(orders.map((o) => o.payment_collections.length)).toEqual([1, 1])
        expect(await emails("group-buy-succeeded")).toHaveLength(2)

        // กลุ่มสำเร็จแล้ว fail ไม่ได้
        const fail = await settle(api.post(`/admin/group-buy/groups/${group.id}/fail`, {}, admin))
        expect(fail.status).toEqual(400)
        expect(fail.data.type).toEqual("not_allowed")
      })
    })

    describe("fail (AC-3, AC-9)", () => {
      it("AC-3: 2 members at ends_at → job fails the group, cancels draft orders, emails both, no payment collection", async () => {
        const campaign = await createCampaign({ target_value: 3 })
        const group = await poolGroup(campaign.id)
        await joinAs(group.join_token, (await customer()).id)
        await joinAs(group.join_token, (await customer()).id)
        await expireGroup(group.id)

        await groupBuyDeadlineJob(getContainer())

        expect((await groupOf(group.id)).status).toEqual("failed")
        const members = await membershipsOf(group.id)
        expect(members.map((m) => m.status)).toEqual(["cancelled", "cancelled"])
        const orders = await ordersOf(members.map((m) => m.order_id))
        expect(orders.map((o) => o.status)).toEqual(["canceled", "canceled"])
        expect(orders.map((o) => o.payment_collections?.length ?? 0)).toEqual([0, 0])
        const sent = await emails("group-buy-failed")
        expect(sent.map((n) => n.resource_id).sort()).toEqual(members.map((m) => m.order_id).sort())
        expect(renderEmailTemplate("group-buy-failed", sent[0].data!)?.subject).toMatch(/[฀-๿]/)
      })

      it("AC-9: fail twice (admin route + workflow) → no duplicate cancellation or emails; succeed after fail → 400", async () => {
        const campaign = await createCampaign({ target_value: 3 })
        const group = await poolGroup(campaign.id)
        await joinAs(group.join_token, (await customer()).id)

        const res = await settle(api.post(`/admin/group-buy/groups/${group.id}/fail`, {}, admin))
        expect(res.status).toEqual(200)
        expect(res.data.group.status).toEqual("failed")
        await failGroupWorkflow(getContainer()).run({ input: { group_id: group.id } })

        expect(await emails("group-buy-failed")).toHaveLength(1)
        const succeed = await settle(api.post(`/admin/group-buy/groups/${group.id}/succeed`, {}, admin))
        expect(succeed.status).toEqual(400)
      })

      it("admin succeed/fail: unknown group → 404, no admin token → 401", async () => {
        expect(
          (await settle(api.post(`/admin/group-buy/groups/gbgrp_nope/succeed`, {}, admin))).status
        ).toEqual(404)
        expect((await settle(api.post(`/admin/group-buy/groups/gbgrp_nope/fail`, {}))).status).toEqual(401)
      })
    })

    describe("deadline job (AC-11, AC-12, AC-22)", () => {
      it("AC-11: target_type=units 10 — 10 units → succeeded; 9 units → failed", async () => {
        const campaign = await createCampaign({ target_type: "units", target_value: 10 })
        const [g10, g9] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        await joinAs(g10.join_token, (await customer()).id, 4)
        await joinAs(g10.join_token, (await customer()).id, 6)
        await joinAs(g9.join_token, (await customer()).id, 4)
        await joinAs(g9.join_token, (await customer()).id, 5)
        await expireGroup(g10.id)
        await expireGroup(g9.id)

        await groupBuyDeadlineJob(getContainer())

        expect((await groupOf(g10.id)).status).toEqual("succeeded")
        expect((await groupOf(g9.id)).status).toEqual("failed")
      })

      it("AC-12: target_type=people 3 — 3 customers (one with 2 orders) → succeeded; 2 customers with 4 orders → failed", async () => {
        const campaign = await createCampaign({ target_type: "people", target_value: 3 })
        const [g3, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const a = (await customer()).id
        await joinAs(g3.join_token, a)
        await joinAs(g3.join_token, a)
        await joinAs(g3.join_token, (await customer()).id)
        await joinAs(g3.join_token, (await customer()).id)
        const [b, c] = [(await customer()).id, (await customer()).id]
        for (const id of [b, b, c, c]) {
          await joinAs(g2.join_token, id)
        }
        await expireGroup(g3.id)
        await expireGroup(g2.id)

        // g3 อาจสำเร็จแล้วจาก event ตอนถึงเป้า — job ข้ามกลุ่มที่ไม่ open ผลต้องเป็น succeeded ทั้งสองทาง
        await groupBuyDeadlineJob(getContainer())

        expect((await groupOf(g3.id)).status).toEqual("succeeded")
        expect((await groupOf(g2.id)).status).toEqual("failed")
      })

      it("AC-22: active campaign past Medusa campaign ends_at → ended after the job; creating a group → 400", async () => {
        const campaign = await createCampaign()
        const { data } = await query().graph({
          entity: "group_buy_campaign",
          fields: ["campaign.id"],
          filters: { id: campaign.id },
        })
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updateCampaigns({ id: (data[0] as any).campaign.id, ends_at: new Date(Date.now() - 1000) })

        await groupBuyDeadlineJob(getContainer())

        const [after] = await groupBuy().listGroupBuyCampaigns({ id: campaign.id })
        expect(after.status).toEqual("ended")
        const res = await settle(api.post(`/admin/group-buy/campaigns/${campaign.id}/groups`, {}, admin))
        expect(res.status).toEqual(400)
      })
    })
  },
})
