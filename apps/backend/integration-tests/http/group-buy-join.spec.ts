import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCartWorkflow, createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { exclusiveAutomaticRule } from "../../src/lib/promotion-exclusivity"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { joinGroupWorkflow } from "../../src/workflows/group-buy/join-group"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"

jest.setTimeout(240 * 1000)

const HOUR = 60 * 60 * 1000

type Res = { status: number; data: any }
type Item = { variant_id: string; quantity: number }
type Shopper = { token: string; customerId: string; headers: { headers: Record<string, string> } }

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

// GB-3: joinGroupWorkflow + store POST /store/group-buy/groups และ join; GB-3b: leave (spec 04)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string
    let productXId: string
    let variantXS: string // t-shirt S — product X (ในขอบเขต)
    let variantXM: string // t-shirt M — product X
    let variantY: string // sweatshirt M — นอกขอบเขต

    beforeAll(async () => {
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
      const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]))
      const variant = (handle: string, title: string) =>
        must(
          must(byHandle[handle], handle).variants.find((v) => v?.title === title),
          `${handle} ${title}`
        ).id
      productXId = must(byHandle["t-shirt"], "t-shirt").id
      variantXS = variant("t-shirt", "S")
      variantXM = variant("t-shirt", "M")
      variantY = variant("sweatshirt", "M")
    })

    const createCampaign = async (data: Partial<CreateGroupBuyCampaignInput> = {}) => {
      const container = getContainer()
      const { result } = await createGroupBuyCampaignWorkflow(container).run({
        input: {
          name: "GB join",
          target_type: "orders",
          target_value: 100,
          group_mode: "both",
          team_duration_hours: 2,
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
      await setGroupBuyCampaignStatusWorkflow(container).run({
        input: { id: result.id, status: "active" },
      })
      return result
    }

    const poolGroup = async (campaignId: string) =>
      (await createGroupWorkflow(getContainer()).run({ input: { campaign_id: campaignId, kind: "pool" } }))
        .result

    const graphGroup = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "group_buy_group",
          fields: [
            "id",
            "campaign_id",
            "progress_orders",
            "progress_units",
            "progress_people",
            "promotion.id",
            "promotion.code",
          ],
          filters: { id },
        })
      return must(data[0], `group ${id}`) as any
    }

    const medusaCampaignId = async (campaignId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "group_buy_campaign", fields: ["campaign.id"], filters: { id: campaignId } })
      return must((data[0] as any)?.campaign?.id, "Medusa campaign") as string
    }

    const progress = async (id: string) => {
      const g = await graphGroup(id)
      return [g.progress_orders, g.progress_units, g.progress_people]
    }

    const memberships = async (filters: Record<string, unknown>) =>
      (
        await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "group_buy_membership",
            fields: ["id", "customer_id", "group_id", "campaign_id", "status", "units", "order_id"],
            filters,
          })
      ).data as any[]

    const ordersOf = async (customerId: string) =>
      (
        await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "order",
            fields: ["id", "status", "is_draft_order", "metadata", "items.adjustments.code"],
            filters: { customer_id: customerId },
          })
      ).data as any[]

    const cartPromotions = async (cartId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["promotions.code", "items.adjustments.code"],
          filters: { id: cartId },
        })
      const cart = must(data[0], `cart ${cartId}`) as any
      return {
        promotions: (cart.promotions ?? []).map((p: any) => p.code).sort(),
        adjustments: [
          ...new Set<string>(
            (cart.items ?? []).flatMap((i: any) => (i.adjustments ?? []).map((a: any) => a.code))
          ),
        ].sort(),
      }
    }

    // ---- store helpers (cart สร้างและแก้ด้วย token ของ customer เจ้าของ cart เสมอ) ----
    const shopper = async (): Promise<Shopper> => {
      const email = `gb3+${Date.now()}${Math.random()}@example.com`
      const { token, customerId } = await registerCustomer(api, pk, email, "gb3-password")
      return { token, customerId, headers: storeHeadersFor(pk, token) }
    }

    const cartFor = async (s: Shopper, items: Item[] = [{ variant_id: variantXS, quantity: 1 }]) => {
      const res = await settle(api.post("/store/carts", { region_id: regionId, items }, s.headers))
      if (res.status !== 200) {
        throw new Error(`create cart: ${res.status} ${JSON.stringify(res.data)}`)
      }
      return res.data.cart.id as string
    }

    const join = (token: string, cartId: string, s?: Shopper) =>
      settle(
        api.post(
          `/store/group-buy/groups/${token}/join`,
          { cart_id: cartId },
          s ? s.headers : storeHeadersFor(pk)
        )
      )

    const joinWithNewCart = async (token: string, s: Shopper, items?: Item[]) =>
      join(token, await cartFor(s, items), s)

    const leave = (membershipId: string, s?: Shopper) =>
      settle(
        api.post(
          `/store/group-buy/memberships/${membershipId}/leave`,
          {},
          s ? s.headers : storeHeadersFor(pk)
        )
      )

    const expectConflict = (res: Res, code: string) => {
      expect(res.status).toEqual(409)
      expect(res.data).toEqual({ type: "conflict", code, message: expect.stringMatching(/\S/) })
    }

    // ---- workflow-level helpers สำหรับ concurrency (สร้างลูกค้า/ cart ตรงผ่าน module/workflow) ----
    const workflowShopper = async (items: Item[] = [{ variant_id: variantXS, quantity: 1 }]) => {
      const container = getContainer()
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email: `gb3c+${Date.now()}${Math.random()}@example.com`, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: { region_id: regionId, customer_id: customer.id, items },
      })
      return { customerId: customer.id, cartId: cart.id }
    }

    const runJoin = async (joinToken: string, s: { customerId: string; cartId: string }) => {
      const { errors } = await joinGroupWorkflow(getContainer()).run({
        input: { join_token: joinToken, cart_id: s.cartId, customer_id: s.customerId },
        throwOnError: false,
      })
      return errors.length === 0
    }

    describe("POST /store/group-buy/groups (AC-6, AC-15)", () => {
      it("group_mode=pool → 403", async () => {
        const campaign = await createCampaign({ group_mode: "pool" })
        const s = await shopper()
        const res = await settle(api.post("/store/group-buy/groups", { campaign_id: campaign.id }, s.headers))
        expect(res.status).toEqual(403)
      })

      it("group_mode=both → 201 team group owned by the caller with its own join_token and ends_at", async () => {
        const campaign = await createCampaign({ group_mode: "both", team_duration_hours: 2 })
        const s = await shopper()
        const res = await settle(
          api.post("/store/group-buy/groups", { campaign_id: campaign.id, name: "ทีมนก" }, s.headers)
        )
        expect(res.status).toEqual(201)
        expect(res.data.group).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbgrp_/),
            campaign_id: campaign.id,
            kind: "team",
            name: "ทีมนก",
            status: "open",
            created_by_customer_id: s.customerId,
            join_token: expect.stringMatching(/^[A-Z0-9]{12}$/),
            ends_at: expect.any(String),
          })
        )
        const { starts_at, ends_at } = res.data.group
        expect(new Date(ends_at).getTime() - new Date(starts_at).getTime()).toEqual(2 * HOUR)
      })

      it("does not accept kind from the body → 400", async () => {
        const campaign = await createCampaign()
        const s = await shopper()
        const res = await settle(
          api.post("/store/group-buy/groups", { campaign_id: campaign.id, kind: "pool" }, s.headers)
        )
        expect(res.status).toEqual(400)
      })

      it("create / join / leave without auth → 401", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const anon = storeHeadersFor(pk)
        expect(
          (await settle(api.post("/store/group-buy/groups", { campaign_id: campaign.id }, anon))).status
        ).toEqual(401)
        expect((await join(group.join_token, "cart_x")).status).toEqual(401)
        expect((await leave("gbmem_x")).status).toEqual(401)
      })
    })

    describe("POST /store/group-buy/groups/:token/join", () => {
      it("creates a draft order with the GB- discount, a membership and counters", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const code = `GB-${group.join_token}`
        const s = await shopper()
        const cartId = await cartFor(s, [{ variant_id: variantXS, quantity: 2 }])

        const res = await join(group.join_token, cartId, s)
        expect(res.status).toEqual(201)
        expect(res.data.membership).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbmem_/),
            group_id: group.id,
            campaign_id: campaign.id,
            customer_id: s.customerId,
            units: 2,
            status: "joined",
            order_id: expect.stringMatching(/^order_/),
          })
        )

        const [order] = await ordersOf(s.customerId)
        expect(order).toEqual(
          expect.objectContaining({
            id: res.data.membership.order_id,
            is_draft_order: true,
            metadata: expect.objectContaining({
              group_buy_group_id: group.id,
              group_buy_membership_id: res.data.membership.id,
            }),
          })
        )
        const orderCodes = order.items.flatMap((i: any) => i.adjustments.map((a: any) => a.code))
        expect([...new Set(orderCodes)]).toEqual([code])
        // กฎข้อ 5: ส่วนลดของ draft order = ส่วนลดที่ Medusa คำนวณบน cart ตอน join
        const { data: carts } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "cart", fields: ["discount_total"], filters: { id: cartId } })
        const { data: drafts } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["discount_total"], filters: { id: order.id } })
        expect(Number(drafts[0].discount_total)).toBeGreaterThan(0)
        expect(Number(drafts[0].discount_total)).toEqual(Number(carts[0].discount_total))
        expect(await progress(group.id)).toEqual([1, 2, 1])
        expect((await cartPromotions(cartId)).promotions).toEqual([code])
      })

      it("unknown token → 404", async () => {
        const s = await shopper()
        const res = await join("NOPE00000000", await cartFor(s), s)
        expect(res.status).toEqual(404)
      })

      it("cart with items outside the campaign → 409 GB_ITEMS_NOT_ELIGIBLE", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const s = await shopper()
        const res = await joinWithNewCart(group.join_token, s, [
          { variant_id: variantXS, quantity: 1 },
          { variant_id: variantY, quantity: 1 },
        ])
        expectConflict(res, "GB_ITEMS_NOT_ELIGIBLE")
      })

      it("AC-4: max_people_per_group=2 → 3rd person 409; 2nd order of A 201 and progress_people stays 2", async () => {
        const campaign = await createCampaign({ max_people_per_group: 2 })
        const group = await poolGroup(campaign.id)
        const [a, b, c] = [await shopper(), await shopper(), await shopper()]
        expect((await joinWithNewCart(group.join_token, a)).status).toEqual(201)
        expect((await joinWithNewCart(group.join_token, b)).status).toEqual(201)

        expectConflict(await joinWithNewCart(group.join_token, c), "GB_GROUP_FULL")
        expect((await joinWithNewCart(group.join_token, a)).status).toEqual(201)
        expect(await progress(group.id)).toEqual([3, 3, 2])
      })

      it("AC-5: max_units_per_person=1 and qty 2 → 409", async () => {
        const campaign = await createCampaign({ max_units_per_person: 1 })
        const group = await poolGroup(campaign.id)
        const s = await shopper()
        expectConflict(
          await joinWithNewCart(group.join_token, s, [{ variant_id: variantXS, quantity: 2 }]),
          "GB_UNITS_LIMIT_EXCEEDED"
        )
      })

      it("AC-17: max_units_per_person=2 counts non-cancelled memberships only", async () => {
        const campaign = await createCampaign({ max_units_per_person: 2 })
        const group = await poolGroup(campaign.id)
        const s = await shopper()
        const first = await joinWithNewCart(group.join_token, s)
        expect(first.status).toEqual(201)

        expectConflict(
          await joinWithNewCart(group.join_token, s, [{ variant_id: variantXM, quantity: 2 }]),
          "GB_UNITS_LIMIT_EXCEEDED"
        )
        expect((await joinWithNewCart(group.join_token, s)).status).toEqual(201)
        expectConflict(await joinWithNewCart(group.join_token, s), "GB_UNITS_LIMIT_EXCEEDED")

        // หลัง leave membership แรก (GB-3b) units ของ membership ที่ cancelled ไม่นับ
        expect((await leave(first.data.membership.id, s)).status).toEqual(200)
        expect((await joinWithNewCart(group.join_token, s)).status).toEqual(201)
      })

      it("AC-13: max_total_orders=5 across 2 groups → 6th join (repeat order too) 409", async () => {
        const campaign = await createCampaign({ max_total_orders: 5 })
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const a = await shopper()
        for (const token of [g1.join_token, g1.join_token, g1.join_token]) {
          expect((await joinWithNewCart(token, a)).status).toEqual(201)
        }
        const b = await shopper()
        for (const token of [g2.join_token, g2.join_token]) {
          expect((await joinWithNewCart(token, b)).status).toEqual(201)
        }
        expectConflict(await joinWithNewCart(g1.join_token, a), "GB_MAX_TOTAL_ORDERS_REACHED")
        expectConflict(await joinWithNewCart(g2.join_token, await shopper()), "GB_MAX_TOTAL_ORDERS_REACHED")
      })

      it("AC-18: a member of G1 joining G2 of the same campaign → 409 GB_ALREADY_IN_OTHER_GROUP", async () => {
        const campaign = await createCampaign()
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const s = await shopper()
        expect((await joinWithNewCart(g1.join_token, s)).status).toEqual(201)
        expectConflict(await joinWithNewCart(g2.join_token, s), "GB_ALREADY_IN_OTHER_GROUP")
      })

      it("AC-14: SAVE10 on the cart → 409; SAVE10 after joining → 409; flash cart joins with GB- only", async () => {
        const container = getContainer()
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const code = `GB-${group.join_token}`
        await createPromotionsWorkflow(container).run({
          input: {
            promotionsData: [
              {
                code: "SAVE10",
                type: "standard",
                status: "active",
                is_automatic: false,
                application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10 },
              },
              {
                code: "FLASH-GB3",
                type: "standard",
                status: "active",
                is_automatic: true,
                rules: [exclusiveAutomaticRule()],
                application_method: {
                  type: "percentage",
                  target_type: "items",
                  allocation: "each",
                  max_quantity: 10,
                  value: 20,
                  target_rules: [{ attribute: "items.variant_id", operator: "in", values: [variantXS] }],
                },
              },
            ],
          },
        })

        // (1) cart ที่มี SAVE10 เข้าร่วมไม่ได้
        const s1 = await shopper()
        const saveCart = await cartFor(s1)
        await api.post(`/store/carts/${saveCart}/promotions`, { promo_codes: ["SAVE10"] }, s1.headers)
        expectConflict(await join(group.join_token, saveCart, s1), "PROMOTION_NOT_COMBINABLE")

        // (3) cart ที่มีส่วนลด flash เข้าร่วมได้ และ draft order มี adjustment จาก GB- เท่านั้น
        const s2 = await shopper()
        const flashCart = await cartFor(s2)
        expect((await cartPromotions(flashCart)).adjustments).toEqual(["FLASH-GB3"])
        const res = await join(group.join_token, flashCart, s2)
        expect(res.status).toEqual(201)
        const [order] = await ordersOf(s2.customerId)
        const orderCodes = order.items.flatMap((i: any) => i.adjustments.map((a: any) => a.code))
        expect([...new Set(orderCodes)]).toEqual([code])

        // (2) หลังเข้าร่วมแล้ว ใส่ SAVE10 ผ่าน route ของ Medusa → PROMOTION_NOT_COMBINABLE (PROMO-2)
        expectConflict(
          await settle(
            api.post(`/store/carts/${flashCart}/promotions`, { promo_codes: ["SAVE10"] }, s2.headers)
          ),
          "PROMOTION_NOT_COMBINABLE"
        )
      })

      it("AC-23: Medusa campaign starts_at moved to the future → 400 not_allowed, nothing left behind", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updateCampaigns({
            id: await medusaCampaignId(campaign.id),
            starts_at: new Date(Date.now() + HOUR),
          })
        const s = await shopper()
        const cartId = await cartFor(s)

        const res = await join(group.join_token, cartId, s)
        expect(res.status).toEqual(400)
        expect(res.data.type).toEqual("not_allowed")
        expect(await ordersOf(s.customerId)).toEqual([])
        expect(await memberships({ group_id: group.id })).toEqual([])
        expect(await progress(group.id)).toEqual([0, 0, 0])
        expect(await cartPromotions(cartId)).toEqual({ promotions: [], adjustments: [] })
      })

      it("AC-23: GB- promotion inactive → 400 GB_DISCOUNT_NOT_APPLIED and the code does not stay on the cart", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const g = await graphGroup(group.id)
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updatePromotions([{ id: g.promotion.id, status: "inactive" }])
        const s = await shopper()
        const cartId = await cartFor(s)

        const res = await join(group.join_token, cartId, s)
        expect(res.status).toEqual(400)
        expect(res.data).toEqual(
          expect.objectContaining({ type: "not_allowed", code: "GB_DISCOUNT_NOT_APPLIED" })
        )
        expect(await ordersOf(s.customerId)).toEqual([])
        expect(await memberships({ group_id: group.id })).toEqual([])
        expect(await progress(group.id)).toEqual([0, 0, 0])
        expect(await cartPromotions(cartId)).toEqual({ promotions: [], adjustments: [] })
      })

      it("counter update fails after the membership insert → transaction rolls back (no membership), order canceled, code removed, locks released", async () => {
        const container = getContainer()
        const campaign = await createCampaign({ max_total_orders: 10 })
        const group = await poolGroup(campaign.id)
        const s = await shopper()
        const cartId = await cartFor(s)
        const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)

        const spy = jest
          .spyOn(groupBuy, "updateGroupBuyGroups")
          .mockRejectedValueOnce(new Error("GB-3 counter boom"))
        let res: Res
        try {
          res = await join(group.join_token, cartId, s)
        } finally {
          spy.mockRestore()
        }
        expect(res.status).toEqual(500)
        const orders = await ordersOf(s.customerId)
        expect(orders.map((o) => o.status)).toEqual(["canceled"])
        expect(await memberships({ group_id: group.id })).toEqual([])
        expect(await progress(group.id)).toEqual([0, 0, 0])
        expect(await cartPromotions(cartId)).toEqual({ promotions: [], adjustments: [] })

        // lock ทั้งสามถูกปล่อยโดย compensation — join ซ้ำได้ทันที
        expect((await join(group.join_token, cartId, s)).status).toEqual(201)
      })

      it("AC-27: joining again with the same cart (same or other group) → 409 GB_CART_ALREADY_JOINED; a new cart → 201", async () => {
        const campaign = await createCampaign()
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const s = await shopper()
        const cartId = await cartFor(s)
        expect((await join(g1.join_token, cartId, s)).status).toEqual(201)

        expectConflict(await join(g1.join_token, cartId, s), "GB_CART_ALREADY_JOINED")
        expectConflict(await join(g2.join_token, cartId, s), "GB_CART_ALREADY_JOINED")
        expect(await memberships({ campaign_id: campaign.id })).toHaveLength(1)
        expect(await ordersOf(s.customerId)).toHaveLength(1)
        expect(await progress(g1.id)).toEqual([1, 1, 1])
        expect(await progress(g2.id)).toEqual([0, 0, 0])

        expect((await joinWithNewCart(g1.join_token, s)).status).toEqual(201)
      })

      describe("AC-26: a cart holding GB-* cannot be completed", () => {
        const readyToComplete = async (s: Shopper, cartId: string) => {
          const ok = (r: Res) => {
            if (r.status !== 200) {
              throw new Error(`prepare checkout: ${r.status} ${JSON.stringify(r.data)}`)
            }
            return r.data
          }
          ok(
            await settle(
              api.post(
                `/store/carts/${cartId}`,
                {
                  email: "gb3-checkout@example.com",
                  shipping_address: {
                    first_name: "Somchai",
                    last_name: "Jaidee",
                    address_1: "1 Sukhumvit Rd",
                    city: "Bangkok",
                    postal_code: "10110",
                    country_code: "th",
                  },
                },
                s.headers
              )
            )
          )
          const { payment_collection } = ok(
            await settle(api.post("/store/payment-collections", { cart_id: cartId }, s.headers))
          )
          ok(
            await settle(
              api.post(
                `/store/payment-collections/${payment_collection.id}/payment-sessions`,
                { provider_id: "pp_system_default" },
                s.headers
              )
            )
          )
        }

        const expectNotCompletable = async (s: Shopper, cartId: string) => {
          const res = await settle(api.post(`/store/carts/${cartId}/complete`, {}, s.headers))
          expect(res.status).toEqual(400)
          expect(res.data).toEqual(
            expect.objectContaining({ type: "not_allowed", code: "GB_CART_NOT_COMPLETABLE" })
          )
          const { data } = await getContainer()
            .resolve(ContainerRegistrationKeys.QUERY)
            .graph({ entity: "cart", fields: ["completed_at"], filters: { id: cartId } })
          expect(data[0].completed_at).toBeNull()
          expect((await ordersOf(s.customerId)).filter((o) => !o.is_draft_order)).toEqual([])
        }

        it("after joining → 400 not_allowed GB_CART_NOT_COMPLETABLE, cart not completed", async () => {
          const campaign = await createCampaign()
          const group = await poolGroup(campaign.id)
          const s = await shopper()
          const cartId = await cartFor(s)
          expect((await join(group.join_token, cartId, s)).status).toEqual(201)

          await readyToComplete(s, cartId)
          await expectNotCompletable(s, cartId)
        })

        it("GB-<token> added through Medusa's promotions route without joining → 400 as well", async () => {
          const campaign = await createCampaign()
          const group = await poolGroup(campaign.id)
          const s = await shopper()
          const cartId = await cartFor(s)
          const added = await settle(
            api.post(`/store/carts/${cartId}/promotions`, { promo_codes: [`GB-${group.join_token}`] }, s.headers)
          )
          expect(added.status).toEqual(200)

          await readyToComplete(s, cartId)
          await expectNotCompletable(s, cartId)
        })
      })

      it("campaign row gone while the group remains → 404 instead of a crash (review #68)", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const s = await shopper()
        const cartId = await cartFor(s)
        const groupBuy: GroupBuyModuleService = getContainer().resolve(GROUP_BUY_MODULE)
        await groupBuy.softDeleteGroupBuyCampaigns(campaign.id)

        const res = await join(group.join_token, cartId, s)
        expect(res.status).toEqual(404)
        expect(await ordersOf(s.customerId)).toEqual([])
        expect(await cartPromotions(cartId)).toEqual({ promotions: [], adjustments: [] })
      })

      it("AC-24: customer B joining with A's cart → 404 and nothing changes", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const [a, b] = [await shopper(), await shopper()]
        const cartA = await cartFor(a)
        const before = await cartPromotions(cartA)

        const res = await join(group.join_token, cartA, b)
        expect(res.status).toEqual(404)
        expect(await memberships({ group_id: group.id })).toEqual([])
        expect(await ordersOf(a.customerId)).toEqual([])
        expect(await ordersOf(b.customerId)).toEqual([])
        expect(await progress(group.id)).toEqual([0, 0, 0])
        expect(await cartPromotions(cartA)).toEqual(before)
      })
    })

    describe("POST /store/group-buy/memberships/:id/leave (GB-3b)", () => {
      const orderStatus = async (customerId: string, orderId: string) =>
        (await ordersOf(customerId)).find((o) => o.id === orderId)?.status
      const statusOf = async (id: string) => (await memberships({ id }))[0]?.status

      it("AC-7: leaving one of two memberships keeps people; the last one decrements people; then join again", async () => {
        const campaign = await createCampaign()
        const g1 = await poolGroup(campaign.id)
        const a = await shopper()
        const m1 = (await joinWithNewCart(g1.join_token, a)).data.membership
        const m2 = (await joinWithNewCart(g1.join_token, a)).data.membership
        expect(await progress(g1.id)).toEqual([2, 2, 1])

        const res = await leave(m1.id, a)
        expect(res.status).toEqual(200)
        expect(res.data.membership).toEqual(expect.objectContaining({ id: m1.id, status: "cancelled" }))
        expect(await progress(g1.id)).toEqual([1, 1, 1])
        expect(await orderStatus(a.customerId, m1.order_id)).toEqual("canceled")
        expect(await orderStatus(a.customerId, m2.order_id)).not.toEqual("canceled")

        expect((await leave(m2.id, a)).status).toEqual(200)
        expect(await progress(g1.id)).toEqual([0, 0, 0])

        expect((await joinWithNewCart(g1.join_token, a)).status).toEqual(201)
        expect(await progress(g1.id)).toEqual([1, 1, 1])
      })

      it("AC-7: after leaving every membership the customer can join another group of the campaign", async () => {
        const campaign = await createCampaign()
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const a = await shopper()
        const m = (await joinWithNewCart(g1.join_token, a)).data.membership
        expectConflict(await joinWithNewCart(g2.join_token, a), "GB_ALREADY_IN_OTHER_GROUP")

        expect((await leave(m.id, a)).status).toEqual(200)
        expect((await joinWithNewCart(g2.join_token, a)).status).toEqual(201)
        expect(await progress(g2.id)).toEqual([1, 1, 1])
      })

      it("AC-25: someone else's / unknown membership → 404; leaving twice → 400 without double decrement", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const [a, b] = [await shopper(), await shopper()]
        const m = (await joinWithNewCart(group.join_token, a)).data.membership

        expect((await leave(m.id, b)).status).toEqual(404)
        expect((await leave("gbmem_missing", a)).status).toEqual(404)
        expect(await statusOf(m.id)).toEqual("joined")
        expect(await orderStatus(a.customerId, m.order_id)).not.toEqual("canceled")
        expect(await progress(group.id)).toEqual([1, 1, 1])

        const res = await leave(m.id, a)
        expect(res.status).toEqual(200)
        expect(await statusOf(m.id)).toEqual("cancelled")
        expect(await orderStatus(a.customerId, m.order_id)).toEqual("canceled")
        expect(await progress(group.id)).toEqual([0, 0, 0])

        const again = await leave(m.id, a)
        expect(again.status).toEqual(400)
        expect(again.data).toEqual(expect.objectContaining({ type: "not_allowed" }))
        expect(await progress(group.id)).toEqual([0, 0, 0])
      })

      it("AC-25: group no longer open → 400 and nothing changes", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const a = await shopper()
        const m = (await joinWithNewCart(group.join_token, a)).data.membership
        const groupBuy: GroupBuyModuleService = getContainer().resolve(GROUP_BUY_MODULE)
        await groupBuy.updateGroupBuyGroups({ id: group.id, status: "succeeded" })

        const res = await leave(m.id, a)
        expect(res.status).toEqual(400)
        expect(res.data).toEqual(expect.objectContaining({ type: "not_allowed" }))
        expect(await statusOf(m.id)).toEqual("joined")
        expect(await orderStatus(a.customerId, m.order_id)).not.toEqual("canceled")
        expect(await progress(group.id)).toEqual([1, 1, 1])
      })

      it("open group whose ends_at has passed (deadline job not run yet) → 400 and nothing changes", async () => {
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const a = await shopper()
        const m = (await joinWithNewCart(group.join_token, a)).data.membership
        const groupBuy: GroupBuyModuleService = getContainer().resolve(GROUP_BUY_MODULE)
        await groupBuy.updateGroupBuyGroups({ id: group.id, ends_at: new Date(Date.now() - 1000) })

        const res = await leave(m.id, a)
        expect(res.status).toEqual(400)
        expect(res.data).toEqual(expect.objectContaining({ type: "not_allowed" }))
        expect(await statusOf(m.id)).toEqual("joined")
        expect(await orderStatus(a.customerId, m.order_id)).not.toEqual("canceled")
        expect(await progress(group.id)).toEqual([1, 1, 1])
      })

      it("AC-25: cancelling the draft order fails → membership back to joined, counters restored, lock released", async () => {
        const container = getContainer()
        const campaign = await createCampaign()
        const group = await poolGroup(campaign.id)
        const a = await shopper()
        const m = (await joinWithNewCart(group.join_token, a)).data.membership
        const orderModule = container.resolve(Modules.ORDER)

        const spy = jest.spyOn(orderModule, "cancel").mockRejectedValueOnce(new Error("GB-3b cancel boom"))
        let res: Res
        try {
          res = await leave(m.id, a)
        } finally {
          spy.mockRestore()
        }
        expect(res.status).toEqual(500)
        expect(await statusOf(m.id)).toEqual("joined")
        expect(await orderStatus(a.customerId, m.order_id)).not.toEqual("canceled")
        expect(await progress(group.id)).toEqual([1, 1, 1])

        // compensation ปล่อย lock ของกลุ่มแล้ว — leave ซ้ำได้ทันที
        expect((await leave(m.id, a)).status).toEqual(200)
        expect(await progress(group.id)).toEqual([0, 0, 0])
      })
    })

    describe("concurrency (ADR-009 lock scope)", () => {
      it("AC-8: 20 concurrent joins, max_people_per_group=5 → exactly 5 people", async () => {
        const campaign = await createCampaign({ max_people_per_group: 5 })
        const group = await poolGroup(campaign.id)
        const shoppers = await Promise.all(Array.from({ length: 20 }, () => workflowShopper()))

        const results = await Promise.all(shoppers.map((s) => runJoin(group.join_token, s)))
        expect(results.filter(Boolean)).toHaveLength(5)
        const rows = (await memberships({ group_id: group.id })).filter((m) => m.status !== "cancelled")
        expect(rows).toHaveLength(5)
        expect(new Set(rows.map((m) => m.customer_id)).size).toEqual(5)
        expect((await progress(group.id))[2]).toEqual(5)
      })

      it("AC-13: 8 concurrent joins across 2 groups, max_total_orders=5 → exactly 5", async () => {
        const campaign = await createCampaign({ max_total_orders: 5 })
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const shoppers = await Promise.all(Array.from({ length: 8 }, () => workflowShopper()))

        const results = await Promise.all(
          shoppers.map((s, i) => runJoin(i % 2 ? g1.join_token : g2.join_token, s))
        )
        expect(results.filter(Boolean)).toHaveLength(5)
        expect(await memberships({ campaign_id: campaign.id })).toHaveLength(5)
        const [p1, p2] = [await progress(g1.id), await progress(g2.id)]
        expect(p1[0] + p2[0]).toEqual(5)
      })

      it("AC-18: one customer joining G1 and G2 at the same time → exactly one succeeds", async () => {
        const campaign = await createCampaign()
        const [g1, g2] = [await poolGroup(campaign.id), await poolGroup(campaign.id)]
        const first = await workflowShopper()
        const { result: cart2 } = await createCartWorkflow(getContainer()).run({
          input: {
            region_id: regionId,
            customer_id: first.customerId,
            items: [{ variant_id: variantXS, quantity: 1 }],
          },
        })

        const results = await Promise.all([
          runJoin(g1.join_token, first),
          runJoin(g2.join_token, { customerId: first.customerId, cartId: cart2.id }),
        ])
        expect(results.filter(Boolean)).toHaveLength(1)
        expect(await memberships({ customer_id: first.customerId })).toHaveLength(1)
      })
    })
  },
})
