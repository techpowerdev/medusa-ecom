import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteRegionsWorkflow, updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import checkGoLive, { goLiveFailures } from "../../src/scripts/check-go-live"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { storeHeadersFor } from "../helpers/customer"

// AC-13: ไม่มี secret ในไฟล์นี้ ("" กัน loadEnv เอาค่าจาก .env มาทับ) — ตั้งก่อน runner โหลด config
process.env.AFFILIATE_TOKEN_SECRET = ""

jest.setTimeout(240 * 1000)

const STRIPE = ["pp_stripe_stripe", "pp_stripe-promptpay_stripe"]
const GO_LIVE_ENV = { NODE_ENV: "production", STRIPE_API_KEY: "sk_live_from_env" }

// OPS-7 (docs/spec/07-scaling-ops.md AC-10, AC-11, AC-13; ADR-010 D1)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const original = { ...process.env }
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const regionProviders = async () => {
      const { data } = await query().graph({
        entity: "region",
        fields: ["id", "payment_providers.id"],
        filters: { name: "Thailand" },
      })
      return { id: data[0].id as string, providers: (data[0].payment_providers ?? []).map((p) => p!.id).sort() }
    }
    const seedWith = async (env: Record<string, string>) => {
      Object.assign(process.env, env)
      try {
        await seedThailand({ container: getContainer(), args: [] })
      } finally {
        process.env = { ...original }
      }
    }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "ops7-admin@example.com"
      delete process.env.SEED_ADMIN_PASSWORD
      await seedWith({ NODE_ENV: "production", ALLOW_TEST_PROVIDERS: "" })
    })

    afterEach(() => {
      process.env = { ...original }
    })

    it("AC-10 production seed on an empty DB enables only the Stripe providers", async () => {
      expect((await regionProviders()).providers).toEqual([...STRIPE].sort())
    })

    it("AC-11 check:go-live passes when every item is satisfied", async () => {
      expect(await goLiveFailures(getContainer(), GO_LIVE_ENV)).toEqual([])
      Object.assign(process.env, GO_LIVE_ENV, { ALLOW_TEST_PROVIDERS: "" })
      await expect(checkGoLive({ container: getContainer(), args: [] })).resolves.toBeUndefined()
    })

    it("AC-11 check:go-live fails on sk_test_ key, ALLOW_TEST_PROVIDERS and pp_system_default", async () => {
      const { id } = await regionProviders()
      await updateRegionsWorkflow(getContainer()).run({
        input: { selector: { id }, update: { payment_providers: ["pp_system_default", ...STRIPE] } },
      })
      try {
        const failures = await goLiveFailures(getContainer(), {
          NODE_ENV: "production",
          STRIPE_API_KEY: "sk_test_123",
          ALLOW_TEST_PROVIDERS: "true",
        })
        expect(failures).toEqual([
          expect.stringContaining("ALLOW_TEST_PROVIDERS"),
          expect.stringContaining("STRIPE_API_KEY"),
          expect.stringContaining("pp_system_default"),
        ])

        // default export ที่ `medusa exec` เรียก → throw = exit code ≠ 0
        Object.assign(process.env, GO_LIVE_ENV, { ALLOW_TEST_PROVIDERS: "" })
        await expect(checkGoLive({ container: getContainer(), args: [] })).rejects.toThrow("pp_system_default")
      } finally {
        await updateRegionsWorkflow(getContainer()).run({
          input: { selector: { id }, update: { payment_providers: STRIPE } },
        })
      }
    })

    it("AC-11 check:go-live fails when not run with NODE_ENV=production or without STRIPE_API_KEY", async () => {
      expect(await goLiveFailures(getContainer(), { NODE_ENV: "development", STRIPE_API_KEY: "sk_live_x" })).toEqual([
        expect.stringContaining("NODE_ENV"),
      ])
      expect(await goLiveFailures(getContainer(), { NODE_ENV: "production" })).toEqual([
        expect.stringContaining("STRIPE_API_KEY"),
      ])
    })

    it("AC-13 GET /store/affiliate/r/:code without a secret redirects without per-request warnings", async () => {
      const pk = await getPublishableKey(getContainer())
      const warn = jest.spyOn(getContainer().resolve(ContainerRegistrationKeys.LOGGER), "warn")
      try {
        for (let i = 0; i < 3; i++) {
          const res = await api
            .get("/store/affiliate/r/nobody?to=/th", { ...storeHeadersFor(pk), maxRedirects: 0 })
            .catch((e: any) => e.response)
          expect(res.status).toEqual(302)
        }
        const messages = warn.mock.calls.map((call) => String(call[0]))
        expect(messages.filter((m) => m.includes("AFFILIATE_TOKEN_SECRET"))).toEqual([])
      } finally {
        warn.mockRestore()
      }
    })

    it("AC-10 production seed with ALLOW_TEST_PROVIDERS=true also enables pp_system_default", async () => {
      const { id } = await regionProviders()
      await deleteRegionsWorkflow(getContainer()).run({ input: { ids: [id] } })

      await seedWith({ NODE_ENV: "production", ALLOW_TEST_PROVIDERS: "true" })

      expect((await regionProviders()).providers).toEqual(["pp_system_default", ...STRIPE].sort())
    })
  },
})
