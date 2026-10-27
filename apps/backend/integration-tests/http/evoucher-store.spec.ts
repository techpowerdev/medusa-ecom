import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, generateJwtToken, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

jest.setTimeout(240 * 1000)

process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

type Res = { status: number; data: any; headers: Record<string, string> }

// error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้ จึงคืนเฉพาะ status/data/headers
const settle = (request: Promise<any>): Promise<Res> =>
  request.then(
    (r) => ({ status: r.status, data: r.data, headers: r.headers }),
    (e) => {
      if (!e?.response) {
        throw new Error(`request failed without response: ${e?.message}`)
      }
      return { status: e.response.status, data: e.response.data, headers: e.response.headers }
    }
  )

// ค้นทุก key ใน object (ลึกทุกชั้น) — AC-35 ต้องไม่มี key ของ code หลุดที่ใดเลย
const allKeys = (value: unknown, acc = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    value.forEach((v) => allKeys(v, acc))
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k)
      allKeys(v, acc)
    }
  }
  return acc
}

const POOL_PARTNER_FIELDS = [
  "+variants.evoucher_pool.name",
  "+variants.evoucher_pool.face_value",
  "+variants.evoucher_pool.validity_note",
  "+variants.evoucher_pool.how_to_use",
  "+variants.evoucher_pool.partner.name",
  "+variants.evoucher_pool.partner.logo_url",
  "+variants.evoucher_pool.partner.terms_url",
].join(",")

// EV-7a (spec 02 กฎข้อ 22, 23; AC-34, AC-35)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let a: { headers: Record<string, string> }
    let b: { headers: Record<string, string> }
    let productId: string
    let voucherVariantId: string
    let aCodeIds: string[]
    let bCodeId: string
    const plaintexts = ["EV7A-A-1", "EV7A-A-2", "EV7A-A-3", "EV7A-B-1", "EV7A-FREE", "EV7A-VOID"]
    const pins = ["7101", "7102", "7103", "7201"]

    beforeAll(async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const ra = await registerCustomer(api, pk, "ev7a-a@example.com", "ev7a-password-a")
      const rb = await registerCustomer(api, pk, "ev7a-b@example.com", "ev7a-password-b")
      a = storeHeadersFor(pk, ra.token)
      b = storeHeadersFor(pk, rb.token)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { handle: "t-shirt" },
      })
      productId = products[0].id
      voucherVariantId = products[0].variants[0].id

      const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
      const partner = await service.createEvoucherPartners({
        name: "Lotus",
        logo_url: "https://example.com/lotus.png",
        terms_url: "https://example.com/terms",
        support_contact: "02-000-0000",
      })
      const pool = await service.createEvoucherPools({
        partner_id: partner.id,
        variant_id: voucherVariantId,
        name: "Lotus 500 THB",
        face_value: 500,
        validity_note: "ใช้ได้ 1 ปี",
        how_to_use: "แสดง code ที่แคชเชียร์",
      })

      const orderModule = container.resolve(Modules.ORDER)
      const orderA = await orderModule.createOrders({
        currency_code: "thb",
        email: "ev7a-a@example.com",
        customer_id: ra.customerId,
      })
      const orderB = await orderModule.createOrders({
        currency_code: "thb",
        email: "ev7a-b@example.com",
        customer_id: rb.customerId,
      })

      const mk = async (i: number, extra: Record<string, unknown>) =>
        service.createEvoucherCodes({
          pool_id: pool.id,
          code: await service.encryptCode(plaintexts[i]),
          pin: pins[i] ? await service.encryptPin(pins[i]) : null,
          batch_ref: "ev7a",
          expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          ...extra,
        })
      const owned = (customerId: string, orderId: string, status: string, deliveredAt?: Date) => ({
        status,
        customer_id: customerId,
        order_id: orderId,
        allocated_at: new Date(),
        delivered_at: deliveredAt ?? null,
      })
      // สร้างทีละตัว: createEvoucherCodes แบบ array ไม่รับประกันลำดับผลตาม input
      const a1 = await mk(0, owned(ra.customerId, orderA.id, "delivered", new Date(Date.now() - 2000)))
      const a2 = await mk(1, owned(ra.customerId, orderA.id, "delivered", new Date(Date.now() - 1000)))
      const a3 = await mk(2, owned(ra.customerId, orderA.id, "allocated"))
      const b1 = await mk(3, owned(rb.customerId, orderB.id, "delivered", new Date()))
      await mk(4, {})
      await mk(5, { status: "void", void_reason: "expiring" })
      aCodeIds = [a1.id, a2.id, a3.id]
      bCodeId = b1.id
    })

    describe("AC-34: GET /store/customers/me/evouchers", () => {
      it("returns only the caller's delivered/allocated codes decrypted, with pool and partner", async () => {
        const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
        const spies = (["info", "warn", "error", "debug", "log", "http"] as const)
          .filter((m) => typeof (logger as any)[m] === "function")
          .map((m) => jest.spyOn(logger as any, m))

        const res = await settle(api.get("/store/customers/me/evouchers", a))
        expect(res.status).toBe(200)
        expect(res.headers["cache-control"]).toContain("no-store")
        expect(res.data.count).toBe(3)
        const ids = res.data.evouchers.map((e: { id: string }) => e.id)
        expect(ids.sort()).toEqual([...aCodeIds].sort())
        expect(ids).not.toContain(bCodeId)

        const byCode = new Map(res.data.evouchers.map((e: any) => [e.code, e]))
        expect([...byCode.keys()].sort()).toEqual(["EV7A-A-1", "EV7A-A-2", "EV7A-A-3"])
        expect(byCode.get("EV7A-A-1")).toEqual(
          expect.objectContaining({
            pin: "7101",
            order_id: expect.any(String),
            expires_at: expect.any(String),
            pool: expect.objectContaining({
              name: "Lotus 500 THB",
              how_to_use: "แสดง code ที่แคชเชียร์",
              validity_note: "ใช้ได้ 1 ปี",
            }),
            partner: {
              name: "Lotus",
              logo_url: "https://example.com/lotus.png",
              terms_url: "https://example.com/terms",
              support_contact: "02-000-0000",
            },
          })
        )
        // เรียง delivered_at ใหม่สุดก่อน: A-2 มาก่อน A-1
        const delivered = res.data.evouchers.filter((e: any) => e.delivered_at).map((e: any) => e.code)
        expect(delivered).toEqual(["EV7A-A-2", "EV7A-A-1"])
        // ไม่หลุดฟิลด์ภายใน
        const keys = allKeys(res.data)
        for (const k of ["batch_ref", "customer_id", "delivered_to_email", "void_reason"]) {
          expect(keys.has(k)).toBe(false)
        }

        const logged = spies.flatMap((s) => s.mock.calls.map((c) => JSON.stringify(c))).join("\n")
        for (const secret of [...plaintexts.slice(0, 3), "7101", "7102", "7103"]) {
          expect(logged).not.toContain(secret)
        }
        spies.forEach((s) => s.mockRestore())
      })

      it("B sees only B's code", async () => {
        const res = await settle(api.get("/store/customers/me/evouchers", b))
        expect(res.status).toBe(200)
        expect(res.data.count).toBe(1)
        expect(res.data.evouchers.map((e: any) => e.id)).toEqual([bCodeId])
        const body = JSON.stringify(res.data)
        for (const id of aCodeIds) {
          expect(body).not.toContain(id)
        }
        for (const code of ["EV7A-A-1", "EV7A-A-2", "EV7A-A-3"]) {
          expect(body).not.toContain(code)
        }
      })

      it("paginates with limit/offset", async () => {
        const res = await settle(api.get("/store/customers/me/evouchers?limit=1&offset=1", a))
        expect(res.status).toBe(200)
        expect(res.data.count).toBe(3)
        expect(res.data.evouchers).toHaveLength(1)
      })

      it.each(["limit=101", "limit=0", "offset=-1"])("rejects %s with 400", async (qs) => {
        const res = await settle(api.get(`/store/customers/me/evouchers?${qs}`, a))
        expect(res.status).toBe(400)
      })

      it("requires a customer: no token or an affiliate token → 401", async () => {
        const noToken = await settle(api.get("/store/customers/me/evouchers", storeHeadersFor(pk)))
        expect(noToken.status).toBe(401)

        const { http } = getContainer().resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
        const affiliateToken = generateJwtToken(
          { actor_id: "aff_ev7a", actor_type: "affiliate", auth_identity_id: "authid_ev7a", app_metadata: {} },
          { secret: http.jwtSecret!, expiresIn: "1d" }
        )
        const affiliate = await settle(
          api.get("/store/customers/me/evouchers", storeHeadersFor(pk, affiliateToken))
        )
        expect(affiliate.status).toBe(401)
      })

      it("has no per-code route → 404", async () => {
        const res = await settle(api.get(`/store/customers/me/evouchers/${aCodeIds[0]}`, a))
        expect(res.status).toBe(404)
      })
    })

    describe("AC-35: pool/partner on GET /store/products*", () => {
      const variantOf = (product: any) =>
        product.variants.find((v: { id: string }) => v.id === voucherVariantId)

      it("returns pool and partner fields of the voucher variant (public, no token)", async () => {
        const res = await settle(
          api.get(`/store/products/${productId}?fields=${POOL_PARTNER_FIELDS}`, storeHeadersFor(pk))
        )
        expect(res.status).toBe(200)
        const pool = variantOf(res.data.product).evoucher_pool
        expect(pool).toEqual(
          expect.objectContaining({
            name: "Lotus 500 THB",
            how_to_use: "แสดง code ที่แคชเชียร์",
            partner: expect.objectContaining({ name: "Lotus", logo_url: "https://example.com/lotus.png" }),
          })
        )
        // variant ที่ไม่มี pool ไม่ error
        const others = res.data.product.variants.filter((v: { id: string }) => v.id !== voucherVariantId)
        expect(others.length).toBeGreaterThan(0)
        others.forEach((v: any) => expect(v.evoucher_pool ?? null).toBeNull())
      })

      it("returns pool fields on the product list too", async () => {
        const res = await settle(
          api.get(`/store/products?id=${productId}&fields=${POOL_PARTNER_FIELDS}`, storeHeadersFor(pk))
        )
        expect(res.status).toBe(200)
        expect(variantOf(res.data.products[0]).evoucher_pool).toEqual(
          expect.objectContaining({ name: "Lotus 500 THB", partner: expect.objectContaining({ name: "Lotus" }) })
        )
      })

      it.each([
        "*variants.evoucher_pool",
        "+variants.evoucher_pool.codes.code",
        "+variants.evoucher_pool.codes.pin",
        "*variants.evoucher_pool.codes",
        "+variants.evoucher_pool.batch_ref",
        "+variants.evoucher_pool.*",
      ])("never exposes code data for fields=%s", async (fields) => {
        for (const url of [
          `/store/products/${productId}?fields=${fields}`,
          `/store/products?id=${productId}&fields=${fields}`,
        ]) {
          const res = await settle(api.get(url, storeHeadersFor(pk)))
          expect(res.status).toBeLessThan(500)
          const keys = allKeys(res.data)
          for (const k of ["codes", "code", "pin", "batch_ref"]) {
            expect(keys.has(k)).toBe(false)
          }
        }
      })
    })
  },
})
