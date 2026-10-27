import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createCustomerAccountWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"

process.env.STOREFRONT_URL = "https://shop.example"

jest.setTimeout(180 * 1000)

const DAY = 24 * 60 * 60 * 1000
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })
const PORTAL_ROUTES = [
  "/affiliate/me",
  "/affiliate/me/programs",
  "/affiliate/me/earnings",
  "/affiliate/me/payouts",
  "/affiliate/products",
]

// AF-7 (spec 05): portal APIs ของ actor `affiliate` (AC-13, AC-18, กฎ 16, 18, Q2, Q6)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let affiliates: AffiliateModuleService
    let collectionC: string
    let collectionDraft: string
    let parentCategory: string
    let childCategory: string
    const products: Record<string, { id: string; variants: { id: string }[] }> = {}

    beforeAll(async () => {
      container = getContainer()
      affiliates = container.resolve(AFFILIATE_MODULE)
      const productModule = container.resolve(Modules.PRODUCT)

      const [store] = await container.resolve(Modules.STORE).listStores()
      await container.resolve(Modules.STORE).updateStores(store.id, {
        supported_currencies: [{ currency_code: "thb", is_default: true }],
      })

      const [c, d] = await productModule.createProductCollections([
        { title: "AF-7 C", handle: "af7-c" },
        { title: "AF-7 draft", handle: "af7-draft" },
      ])
      collectionC = c.id
      collectionDraft = d.id
      const parent = await productModule.createProductCategories({ name: "AF-7 parent", is_active: true })
      const child = await productModule.createProductCategories({
        name: "AF-7 child",
        is_active: true,
        parent_category_id: parent.id,
      })
      parentCategory = parent.id
      childCategory = child.id

      const product = (handle: string, extra: Record<string, unknown> = {}) => ({
        title: handle,
        handle,
        status: ProductStatus.PUBLISHED,
        options: [{ title: "Size", values: ["S", "M"] }],
        variants: ["S", "M"].map((size) => ({
          title: size,
          manage_inventory: false,
          options: { Size: size },
          prices: [{ currency_code: "thb", amount: 500 }],
        })),
        ...extra,
      })
      const eventBus = container.resolve(Modules.EVENT_BUS)
      // รอ subscriber ของ product (search index) ให้เสร็จก่อน runner snapshot DB
      const indexed = Promise.all(
        [
          ["product.created", 7],
          ["product-variant.created", 14],
        ].map(([name, triggerCount]) =>
          TestEventUtils.waitSubscribersExecution(name as string, eventBus, { triggerCount: triggerCount as number })
        )
      )
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            product("af7-variant"),
            product("af7-in-c-1", { collection_id: collectionC }),
            product("af7-in-c-2", { collection_id: collectionC }),
            product("af7-parent-cat", { category_ids: [parentCategory] }),
            product("af7-child-cat", { category_ids: [childCategory] }),
            product("af7-draft-scope", { collection_id: collectionDraft }),
            product("af7-unpublished", { collection_id: collectionC, status: ProductStatus.DRAFT }),
          ],
        },
      })
      await indexed
      for (const p of result) {
        products[p.handle] = p
      }
    })

    const createProgram = (overrides: Record<string, unknown> = {}) =>
      affiliates.createAffiliatePrograms({
        name: "P",
        status: "published",
        starts_at: new Date(Date.now() - DAY),
        ends_at: new Date(Date.now() + 7 * DAY),
        commission_type: "percentage",
        commission_value: 10,
        scope: { all: true },
        ...overrides,
      })

    const loginAffiliate = async (code: string, status: "pending" | "active" | "suspended") => {
      const credentials = { email: `${code}@example.com`, password: "affiliate-password" }
      const { data } = await api.post("/auth/affiliate/emailpass/register", credentials)
      const { data: created } = await api.post("/affiliate/register", { name: code, code }, bearer(data.token))
      await affiliates.updateAffiliates({ id: created.affiliate.id, status })
      const { data: login } = await api.post("/auth/affiliate/emailpass", credentials)
      return { token: login.token as string, id: created.affiliate.id as string }
    }

    const statusOf = (url: string, token?: string) =>
      api.get(url, token ? bearer(token) : undefined).then(
        (r) => r.status,
        (e) => e.response.status
      )

    describe("AC-18: every /affiliate/* route except register needs an affiliate token", () => {
      it("returns 401 without a token", async () => {
        for (const url of PORTAL_ROUTES) {
          expect([url, await statusOf(url)]).toEqual([url, 401])
        }
      })

      // review #110: Express จับ route แบบไม่สนตัวพิมพ์ — matcher ของ auth ต้องไม่สนตัวพิมพ์ด้วย
      it("returns 401 without a token when the path differs only in case", async () => {
        for (const url of ["/AFFILIATE/me", "/Affiliate/me/payouts", "/affiliate/PRODUCTS"]) {
          expect([url, await statusOf(url)]).toEqual([url, 401])
        }
      })

      it("returns 401 for a customer token", async () => {
        const customer = { email: "af7-cust@example.com", password: "cust-password" }
        const { authIdentity } = await container.resolve(Modules.AUTH).register("emailpass", { body: customer })
        await createCustomerAccountWorkflow(container).run({
          input: { authIdentityId: authIdentity!.id, customerData: { email: customer.email } },
        })
        const { data } = await api.post("/auth/customer/emailpass", customer)

        for (const url of PORTAL_ROUTES) {
          expect([url, await statusOf(url, data.token)]).toEqual([url, 401])
        }
      })
    })

    describe("Q6: access by affiliate status", () => {
      it("pending reaches only /affiliate/me", async () => {
        const { token } = await loginAffiliate("pen", "pending")
        const statuses = await Promise.all(PORTAL_ROUTES.map((url) => statusOf(url, token)))
        expect(statuses).toEqual([200, 403, 403, 403, 403])
      })

      it("suspended reads me, earnings and payouts but not programs or products", async () => {
        const { token } = await loginAffiliate("sus", "suspended")
        const statuses = await Promise.all(PORTAL_ROUTES.map((url) => statusOf(url, token)))
        expect(statuses).toEqual([200, 403, 200, 200, 403])
      })

      it("active reaches every portal route", async () => {
        const { token } = await loginAffiliate("act", "active")
        const statuses = await Promise.all(PORTAL_ROUTES.map((url) => statusOf(url, token)))
        expect(statuses).toEqual([200, 200, 200, 200, 200])
      })
    })

    describe("GET /affiliate/products", () => {
      const handles = (body: { products: { product: { handle: string } }[] }) =>
        body.products.map((p) => p.product.handle).sort()

      it("AC-13: an upcoming program lists its collection's products; draft programs never show", async () => {
        const { token } = await loginAffiliate("ann", "active")
        const tomorrow = new Date(Date.now() + DAY)
        const p2 = await createProgram({
          name: "P2",
          starts_at: tomorrow,
          commission_value: 12,
          scope: { collection_ids: [collectionC] },
        })
        await createProgram({ name: "Draft", status: "draft", scope: { collection_ids: [collectionDraft] } })
        await createProgram({ name: "Draft soon", status: "draft", starts_at: tomorrow, scope: { all: true } })

        const upcoming = await api.get("/affiliate/products?status=upcoming", bearer(token))
        expect(handles(upcoming.data)).toEqual(["af7-in-c-1", "af7-in-c-2"])
        expect(upcoming.data.count).toEqual(2)
        const item = upcoming.data.products.find((p: any) => p.product.handle === "af7-in-c-1")
        expect(item.program).toEqual(
          expect.objectContaining({ id: p2.id, name: "P2", commission_value: 12, starts_at: tomorrow.toISOString() })
        )
        expect(item.share_url).toEqual("https://shop.example/r/ann?to=/products/af7-in-c-1")
        expect(item.product.variants).toHaveLength(2)
        expect(item.product.variants[0].calculated_price).toEqual(
          expect.objectContaining({ calculated_amount: 500, currency_code: "thb" })
        )

        const active = await api.get("/affiliate/products?status=active", bearer(token))
        expect(active.data.products).toEqual([])
      })

      it("rule 16 / Q2: active scope is the union of variants, collections and direct categories", async () => {
        const { token } = await loginAffiliate("bob", "active")
        await createProgram({
          scope: {
            variant_ids: [products["af7-variant"].variants[1].id],
            category_ids: [parentCategory],
          },
        })
        // ended ภายในช่วงเวลา และ published ที่หมดเวลาแล้ว → ไม่แสดง (กฎ 9, 10)
        await createProgram({ status: "ended", scope: { all: true } })
        await createProgram({ starts_at: new Date(Date.now() - 3 * DAY), ends_at: new Date(Date.now() - DAY) })

        const { data } = await api.get("/affiliate/products", bearer(token))

        expect(handles(data)).toEqual(["af7-parent-cat", "af7-variant"])
        const variantItem = data.products.find((p: any) => p.product.handle === "af7-variant")
        expect(variantItem.product.variants.map((v: any) => v.id)).toEqual([products["af7-variant"].variants[1].id])
      })

      it("pages through programs ordered by starts_at", async () => {
        const { token } = await loginAffiliate("cat", "active")
        const later = await createProgram({ name: "later", scope: { collection_ids: [collectionC] } })
        const earlier = await createProgram({
          name: "earlier",
          starts_at: new Date(Date.now() - 2 * DAY),
          scope: { category_ids: [childCategory] },
        })

        const pages = await Promise.all(
          [1, 2, 3, 4].map((page) => api.get(`/affiliate/products?limit=1&page=${page}`, bearer(token)))
        )

        expect(pages.map((p) => p.data.count)).toEqual([3, 3, 3, 3])
        expect(pages.map((p) => p.data.products.map((i: any) => i.program.id))).toEqual([
          [earlier.id],
          [later.id],
          [later.id],
          [],
        ])
        expect(pages[0].data.products[0].product.handle).toEqual("af7-child-cat")
        expect(new Set(pages.slice(1, 3).map((p) => p.data.products[0].product.handle))).toEqual(
          new Set(["af7-in-c-1", "af7-in-c-2"])
        )
      })

      it("rejects an unknown status", async () => {
        const { token } = await loginAffiliate("dan", "active")
        expect(await statusOf("/affiliate/products?status=ended", token)).toEqual(400)
      })
    })

    describe("GET /affiliate/me/programs, earnings, payouts", () => {
      it("lists published programs that are active or upcoming with their state", async () => {
        const { token } = await loginAffiliate("eve", "active")
        const active = await createProgram({ name: "now", announce_text: "เปิดแล้ว" })
        const soon = await createProgram({ name: "soon", starts_at: new Date(Date.now() + DAY) })
        await createProgram({ name: "draft", status: "draft" })
        await createProgram({ name: "ended", status: "ended" })

        const { data } = await api.get("/affiliate/me/programs", bearer(token))

        expect(data.programs.map((p: any) => [p.id, p.state])).toEqual([
          [active.id, "active"],
          [soon.id, "upcoming"],
        ])
        expect(data.programs[0]).toEqual(
          expect.objectContaining({ announce_text: "เปิดแล้ว", commission_value: 10, hold_days: 14 })
        )
      })

      it("pages programs and payouts with limit/offset", async () => {
        const { token, id } = await loginAffiliate("hal", "active")
        const first = await createProgram({ name: "first", starts_at: new Date(Date.now() - 2 * DAY) })
        const second = await createProgram({ name: "second" })
        await affiliates.createAffiliatePayouts(
          [1, 2, 3].map((amount) => ({
            affiliate_id: id,
            amount,
            currency: "thb",
            period_from: new Date(Date.now() - 30 * DAY),
            period_to: new Date(),
            entry_ids: [],
          }))
        )

        const programs = await api.get("/affiliate/me/programs?limit=1&offset=1", bearer(token))
        expect(programs.data).toEqual(
          expect.objectContaining({ count: 2, limit: 1, offset: 1, programs: [expect.objectContaining({ id: second.id })] })
        )
        expect((await api.get("/affiliate/me/programs?limit=1", bearer(token))).data.programs[0].id).toEqual(first.id)

        const payouts = await api.get("/affiliate/me/payouts?limit=2", bearer(token))
        expect(payouts.data).toEqual(expect.objectContaining({ count: 3, limit: 2, offset: 0 }))
        expect(payouts.data.payouts).toHaveLength(2)
        expect(await statusOf("/affiliate/me/payouts?limit=1000", token)).toEqual(400)
      })

      it("returns only the caller's earnings totals by status within [from, to) and own payouts", async () => {
        const { token, id } = await loginAffiliate("fay", "suspended")
        const other = await loginAffiliate("gus", "active")
        const entry = (affiliate_id: string, amount: number, status: string) => ({
          affiliate_id,
          program_id: "affprog_x",
          order_id: `order_${Math.random()}`,
          amount,
          currency: "thb",
          status: status as any,
        })
        await affiliates.createAffiliateCommissionEntries([
          entry(id, 100, "pending"),
          entry(id, 50, "approved"),
          entry(id, 20, "approved"),
          entry(id, -10, "reversed"),
          entry(other.id, 999, "approved"),
        ])
        await affiliates.createAffiliatePayouts([
          {
            affiliate_id: id,
            amount: 70,
            currency: "thb",
            period_from: new Date(Date.now() - 30 * DAY),
            period_to: new Date(),
            entry_ids: [],
          },
          {
            affiliate_id: other.id,
            amount: 999,
            currency: "thb",
            period_from: new Date(Date.now() - 30 * DAY),
            period_to: new Date(),
            entry_ids: [],
          },
        ])

        const { data } = await api.get("/affiliate/me/earnings", bearer(token))
        expect(data.totals).toEqual([
          { currency: "thb", status: "approved", amount: 70, count: 2 },
          { currency: "thb", status: "pending", amount: 100, count: 1 },
          { currency: "thb", status: "reversed", amount: -10, count: 1 },
        ])
        const future = new Date(Date.now() + DAY).toISOString()
        const empty = await api.get(`/affiliate/me/earnings?from=${future}`, bearer(token))
        expect(empty.data.totals).toEqual([])

        const payouts = await api.get("/affiliate/me/payouts", bearer(token))
        expect(payouts.data.payouts).toEqual([expect.objectContaining({ affiliate_id: id, amount: 70 })])
        expect(payouts.data.payouts[0].entry_ids).toBeUndefined()
      })
    })
  },
})
