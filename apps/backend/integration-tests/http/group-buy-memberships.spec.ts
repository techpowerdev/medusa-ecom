import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { joinGroupWorkflow } from "../../src/workflows/group-buy/join-group"
import { leaveGroupWorkflow } from "../../src/workflows/group-buy/leave-group"

jest.setTimeout(240 * 1000)

const ADMIN_EMAIL = "gb-6c-admin@example.com"
const ADMIN_PASSWORD = "gb-6c-password"
const HOUR = 60 * 60 * 1000

type Res = { status: number; data: any }

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

// GB-6c: GET /admin/group-buy/groups/:id/memberships (spec 04 API, AC-34)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }
    let groupId: string
    let joined: { id: string; order_id: string; email: string }
    let cancelled: { id: string; order_id: string; email: string }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "handle", "variants.id"],
        filters: { handle: "t-shirt" },
      })
      const product = products[0]

      const { result: campaign } = await createGroupBuyCampaignWorkflow(container).run({
        input: {
          name: "GB-6c memberships",
          target_type: "orders",
          target_value: 5,
          group_mode: "pool",
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 10,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [product.id] }],
          },
          rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
        } as CreateGroupBuyCampaignInput,
      })
      await setGroupBuyCampaignStatusWorkflow(container).run({ input: { id: campaign.id, status: "active" } })
      const { result: group } = await createGroupWorkflow(container).run({
        input: { campaign_id: campaign.id, kind: "pool" },
      })
      groupId = group.id

      const join = async (email: string) => {
        const customer = await container
          .resolve(Modules.CUSTOMER)
          .createCustomers({ email, has_account: true })
        const { result: cart } = await createCartWorkflow(container).run({
          input: {
            region_id: regions[0].id,
            customer_id: customer.id,
            items: [{ variant_id: product.variants[0].id, quantity: 1 }],
          },
        })
        const { result } = await joinGroupWorkflow(container).run({
          input: { join_token: group.join_token, cart_id: cart.id, customer_id: customer.id },
        })
        return { id: result.id, order_id: result.order_id, email, customer_id: customer.id }
      }

      joined = await join(`gb6c-a+${Date.now()}@example.com`)
      const left = await join(`gb6c-b+${Date.now()}@example.com`)
      // รอ subscriber ของ order.canceled ให้จบก่อน snapshot ของ test runner — ไม่เช่นนั้น workflow ที่ค้างใน snapshot
      // ทำให้ afterEach (waitWorkflowExecutions) รอจน timeout หลัง restore
      const canceled = TestEventUtils.waitSubscribersExecution("order.canceled", container.resolve(Modules.EVENT_BUS))
      await leaveGroupWorkflow(container).run({
        input: { membership_id: left.id, customer_id: left.customer_id },
      })
      await canceled
      cancelled = left
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      admin = { headers: { authorization: `Bearer ${data.token}` } }
    })

    const get = (path: string, headers = admin) => settle(api.get(path, headers))

    it("AC-34: lists memberships with order + customer email matching the DB", async () => {
      const res = await get(`/admin/group-buy/groups/${groupId}/memberships`)
      expect(res.status).toEqual(200)
      expect(res.data.count).toEqual(2)
      expect(res.data.memberships).toHaveLength(2)

      const { data: orders } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["id", "status", "is_draft_order", "total"],
          filters: { id: [joined.order_id, cancelled.order_id] },
        })
      const byId = Object.fromEntries(orders.map((o: any) => [o.id, o]))

      const byStatus = Object.fromEntries(res.data.memberships.map((m: any) => [m.status, m]))
      for (const [status, expected] of [
        ["joined", joined],
        ["cancelled", cancelled],
      ] as const) {
        const m = byStatus[status]
        expect(m).toEqual(
          expect.objectContaining({
            id: expected.id,
            units: 1,
            order_id: expected.order_id,
            customer: { email: expected.email },
          })
        )
        expect(m.joined_at).toBeTruthy()
        expect(m.order).toEqual(
          expect.objectContaining({
            status: byId[expected.order_id].status,
            is_draft_order: true,
            payment_status: "not_paid",
          })
        )
        expect(Number(m.order.total)).toEqual(Number(byId[expected.order_id].total))
      }
      expect(byStatus.cancelled.order.status).toEqual("canceled")
    })

    it("AC-34: limit=1&offset=1 → 1 membership, count=2", async () => {
      const res = await get(`/admin/group-buy/groups/${groupId}/memberships?limit=1&offset=1`)
      expect(res.status).toEqual(200)
      expect(res.data.memberships).toHaveLength(1)
      expect(res.data.count).toEqual(2)
    })

    it.each(["limit=101", "limit=0", "offset=-1", "limit=abc"])("AC-34: %s → 400", async (qs) => {
      const res = await get(`/admin/group-buy/groups/${groupId}/memberships?${qs}`)
      expect(res.status).toEqual(400)
      expect(res.data.type).toEqual("invalid_data")
    })

    it("AC-34: unknown group → 404", async () => {
      const res = await get(`/admin/group-buy/groups/gbgrp_missing/memberships`)
      expect(res.status).toEqual(404)
    })

    it("AC-34: no admin token → 401", async () => {
      const res = await get(`/admin/group-buy/groups/${groupId}/memberships`, { headers: {} })
      expect(res.status).toEqual(401)
    })
  },
})
