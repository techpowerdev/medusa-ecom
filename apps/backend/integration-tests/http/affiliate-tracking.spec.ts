import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import { verifyAffiliateToken } from "../../src/modules/affiliate/utils/token"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"

// secret ของ token มาจาก env เท่านั้น (medusa-config → module option) — ตั้งก่อน runner โหลด config
const SECRET = "af2-integration-secret"
process.env.AFFILIATE_TOKEN_SECRET = SECRET

jest.setTimeout(240 * 1000)

type Result = { status?: number; headers: Record<string, any>; data?: any }

// GET แบบไม่ตาม redirect เพื่อดู 302 + Set-Cookie
const raw = (request: Promise<any>): Promise<Result> =>
  request.then(
    ({ status, headers, data }) => ({ status, headers, data }),
    (e) => ({ status: e.response?.status, headers: e.response?.headers ?? {}, data: e.response?.data })
  )

const affCookie = (headers: Record<string, any>) =>
  ([].concat(headers["set-cookie"] ?? []) as string[]).find((c) => c.startsWith("aff="))

const cookieValue = (cookie: string) => cookie.split(";")[0].slice("aff=".length)

// AF-2 (spec 05): tracking redirect `GET /store/affiliate/r/:code?to=` (public) ตั้ง signed cookie `aff` แล้ว 302
// และ cart metadata `affiliate_token` เขียนได้ผ่าน store API ของ Medusa ด้วย token ของเจ้าของ cart (CORE-6/12)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let regionId: string

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "af2-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "af2-test-password"
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
    })

    const createAffiliate = async (code: string, status: "pending" | "active" | "suspended") => {
      const affiliateModule = getContainer().resolve<AffiliateModuleService>(AFFILIATE_MODULE)
      return affiliateModule.createAffiliates({ email: `${code}@example.com`, name: code, code, status })
    }

    const track = (code: string, to?: string) =>
      raw(
        api.get(`/store/affiliate/r/${code}${to === undefined ? "" : `?to=${encodeURIComponent(to)}`}`, {
          ...storeHeadersFor(pk),
          maxRedirects: 0,
        })
      )

    describe("GET /store/affiliate/r/:code", () => {
      it("sets a signed aff cookie for an active affiliate and 302s to the path (no customer login)", async () => {
        const ann = await createAffiliate("ann", "active")
        const before = Date.now()

        const res = await track("ann", "/products/t-shirt")

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe("/products/t-shirt")
        const cookie = affCookie(res.headers)
        expect(cookie).toBeDefined()
        expect(cookie).toMatch(/HttpOnly/i)
        expect(cookie).toMatch(/SameSite=Lax/i)
        expect(cookie).toMatch(/Path=\//)
        expect(cookie).toMatch(/Max-Age=2592000/)

        const payload = verifyAffiliateToken(decodeURIComponent(cookieValue(cookie!)), SECRET)
        expect(payload?.affiliate_id).toBe(ann.id)
        expect(payload!.clicked_at.getTime()).toBeGreaterThanOrEqual(before)
        expect(payload!.clicked_at.getTime()).toBeLessThanOrEqual(Date.now())
      })

      it("matches the code case-insensitively", async () => {
        const ann = await createAffiliate("ann", "active")

        const res = await track("ANN", "/")

        const payload = verifyAffiliateToken(decodeURIComponent(cookieValue(affCookie(res.headers)!)), SECRET)
        expect(payload?.affiliate_id).toBe(ann.id)
      })

      it.each(["pending", "suspended"] as const)(
        "redirects without a cookie when the affiliate is %s (rule 7)",
        async (status) => {
          await createAffiliate("bob", status)

          const res = await track("bob", "/products/t-shirt")

          expect(res.status).toBe(302)
          expect(res.headers.location).toBe("/products/t-shirt")
          expect(affCookie(res.headers)).toBeUndefined()
        }
      )

      it("redirects without a cookie for an unknown code", async () => {
        const res = await track("nobody", "/products/t-shirt")

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe("/products/t-shirt")
        expect(affCookie(res.headers)).toBeUndefined()
      })

      it.each(["https://evil.example", "//evil.example", undefined])(
        "redirects to / instead of an external or missing target %p",
        async (to) => {
          await createAffiliate("ann", "active")

          const res = await track("ann", to)

          expect(res.status).toBe(302)
          expect(res.headers.location).toBe("/")
        }
      )

      it("does not write to the database (non-functional: redirect is read-only)", async () => {
        await createAffiliate("ann", "active")
        const affiliateModule = getContainer().resolve<AffiliateModuleService>(AFFILIATE_MODULE)
        const [, before] = await affiliateModule.listAndCountAffiliateAttributions({})

        await track("ann", "/")

        const [, after] = await affiliateModule.listAndCountAffiliateAttributions({})
        expect(after).toBe(before)
      })
    })

    describe("cart metadata.affiliate_token (storefront cart hook)", () => {
      it("is written by the cart owner through the Medusa store API; other customers get 404", async () => {
        await createAffiliate("ann", "active")
        const token = decodeURIComponent(cookieValue(affCookie((await track("ann", "/")).headers)!))
        const owner = await registerCustomer(api, pk, "af2-owner@example.com", "af2-owner-password")
        const other = await registerCustomer(api, pk, "af2-other@example.com", "af2-other-password")
        const ownerConfig = storeHeadersFor(pk, owner.token)
        const { data } = await api.post("/store/carts", { region_id: regionId }, ownerConfig)

        const updated = await api.post(
          `/store/carts/${data.cart.id}`,
          { metadata: { affiliate_token: token } },
          ownerConfig
        )
        expect(updated.status).toBe(200)
        expect(updated.data.cart.metadata).toEqual(expect.objectContaining({ affiliate_token: token }))

        const forbidden = await raw(
          api.post(
            `/store/carts/${data.cart.id}`,
            { metadata: { affiliate_token: "forged" } },
            storeHeadersFor(pk, other.token)
          )
        )
        expect(forbidden.status).toBe(404)
        const guest = await raw(
          api.post(`/store/carts/${data.cart.id}`, { metadata: { affiliate_token: "forged" } }, storeHeadersFor(pk))
        )
        expect(guest.status).toBe(401)
      })
    })
  },
})
