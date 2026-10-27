import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { seedLoad } from "../../src/scripts/seed-load"

jest.setTimeout(240 * 1000)

// OPS-4 (spec 07 AC-2, AC-3, Q-O3 b): seed ของ load test — ลูกค้า N คนผ่าน workflow ของ Medusa + token จาก
// /auth/customer/emailpass, flash campaign (total_cap) และ pool group (max_people_per_group) ที่ k6 ยิง
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const opts = () => ({
      authUrl: api.defaults.baseURL as string,
      flashCustomers: 3,
      joinCustomers: 2,
      totalCap: 2,
      groupSize: 2,
    })

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = "ops4-admin@example.com"
      process.env.SEED_ADMIN_PASSWORD = "ops4-test-password"
      await seedThailand({ container: getContainer(), args: [] })
    })

    it("สร้างลูกค้าตามจำนวนพร้อม token ที่ใช้กับ store API ได้ (ไม่ซ้ำกันระหว่าง flash และ join)", async () => {
      const data = await seedLoad(getContainer(), opts())
      expect(data.flash.customers).toHaveLength(3)
      expect(data.group_buy.customers).toHaveLength(2)
      const all = [...data.flash.customers, ...data.group_buy.customers]
      expect(new Set(all.map((c) => c.customer_id)).size).toEqual(5)

      for (const c of all) {
        const res = await api.get("/store/customers/me", {
          headers: { "x-publishable-api-key": data.publishable_key, authorization: `Bearer ${c.token}` },
        })
        expect(res.status).toEqual(200)
        expect(res.data.customer.id).toEqual(c.customer_id)
      }
      expect(data).toMatchObject({
        region_id: expect.stringMatching(/^reg_/),
        shipping_option_id: expect.stringMatching(/^so_/),
      })
    })

    it("flash campaign มี config total_cap และ automatic promotion ที่ target variant ของ load", async () => {
      const data = await seedLoad(getContainer(), opts())
      const { data: configs } = await query().graph({
        entity: "flash_sale_config",
        fields: ["total_cap", "units_sold", "per_customer_limit"],
        filters: { campaign_id: data.flash.campaign_id },
      })
      expect(configs).toEqual([expect.objectContaining({ total_cap: 2, units_sold: 0 })])

      const { data: promotions } = await query().graph({
        entity: "promotion",
        fields: ["status", "is_automatic", "application_method.target_rules.values.value"],
        filters: { campaign_id: data.flash.campaign_id },
      })
      expect(promotions).toHaveLength(1)
      expect(promotions[0]).toMatchObject({ status: "active", is_automatic: true })
      const targets = promotions[0].application_method!.target_rules!.flatMap((r) => r!.values!.map((v) => v!.value))
      expect(targets).toEqual([data.flash.variant_id])
    })

    it("group buy campaign active + pool group เปิดอยู่ที่ max_people_per_group = groupSize", async () => {
      const data = await seedLoad(getContainer(), opts())
      const { data: groups } = await query().graph({
        entity: "group_buy_group",
        fields: ["id", "kind", "status", "campaign_id"],
        filters: { join_token: data.group_buy.join_token },
      })
      expect(groups).toEqual([
        expect.objectContaining({ id: data.group_buy.group_id, kind: "pool", status: "open" }),
      ])
      const { data: campaigns } = await query().graph({
        entity: "group_buy_campaign",
        fields: ["status", "max_people_per_group"],
        filters: { id: groups[0].campaign_id },
      })
      expect(campaigns).toEqual([expect.objectContaining({ status: "active", max_people_per_group: 2 })])
      expect(data.group_buy.variant_id).toMatch(/^variant_/)
      expect(data.group_buy.variant_id).not.toEqual(data.flash.variant_id)
    })

    it("production ที่ไม่ได้ตั้ง ALLOW_TEST_PROVIDERS=true → ปฏิเสธ (ไม่สร้างลูกค้ารหัสผ่านที่รู้กันใน prod)", async () => {
      const saved = { NODE_ENV: process.env.NODE_ENV, ALLOW: process.env.ALLOW_TEST_PROVIDERS }
      process.env.NODE_ENV = "production"
      delete process.env.ALLOW_TEST_PROVIDERS
      try {
        await expect(seedLoad(getContainer(), opts())).rejects.toThrow(/ALLOW_TEST_PROVIDERS/)
      } finally {
        process.env.NODE_ENV = saved.NODE_ENV
        if (saved.ALLOW !== undefined) {
          process.env.ALLOW_TEST_PROVIDERS = saved.ALLOW
        }
      }
    })
  },
})
