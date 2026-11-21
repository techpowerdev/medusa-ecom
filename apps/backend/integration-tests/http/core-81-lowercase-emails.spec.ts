import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import type AffiliateModuleService from "../../src/modules/affiliate/service"
import lowercaseEmailsScript, { lowercaseEmails } from "../../src/scripts/lowercase-emails"

jest.setTimeout(120 * 1000)

// CORE-81 (spec 01 กฎข้อ 139, AC-180): แปลงอีเมลเดิม (ก่อน CORE-80) เป็นตัวเล็ก — dry-run, ตรวจชน, apply ผ่าน workflow
const PASSWORD = "Secret-PW1"

// ห่อ error ของ axios (circular) เป็นค่าธรรมดา — CLAUDE.md บทเรียน
const status = (request: Promise<{ status: number }>) =>
  request.then(
    (r) => r.status,
    (e: { response?: { status: number } }) => e.response?.status
  )

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const auth = () => getContainer().resolve(Modules.AUTH)
    const customers = () => getContainer().resolve(Modules.CUSTOMER)
    const affiliates = (): AffiliateModuleService => getContainer().resolve(AFFILIATE_MODULE)

    const publishableKey = async () => {
      const [key] = await getContainer()
        .resolve(Modules.API_KEY)
        .createApiKeys([{ title: "core-81", type: "publishable", created_by: "core-81" }])
      return key.token
    }
    const identityOf = async (entityId: string) => (await auth().listProviderIdentities({ entity_id: entityId }))[0]
    // ข้อมูลเก่าก่อน CORE-80: สมัครด้วยตัวเล็ก (middleware แปลงให้แล้ว) แล้วเขียนค่าเดิมที่มีตัวใหญ่กลับผ่าน module
    const setIdentityEmail = async (from: string, to: string) =>
      auth().updateProviderIdentities([{ id: (await identityOf(from)).id, entity_id: to }])

    const snapshot = async () => ({
      identities: (await auth().listProviderIdentities({ provider: "emailpass" })).map((p) => p.entity_id).sort(),
      customers: (await customers().listCustomers({}, { select: ["email"] })).map((c) => c.email).sort(),
      affiliates: (await affiliates().listAffiliates({}, { select: ["email"] })).map((a) => a.email).sort(),
    })

    // 1 ชุด: identity + customer ของลูกค้า และ affiliate ตัวพิมพ์ใหญ่ = 3 แถว
    const seedMixedCase = async () => {
      const { customerId } = await registerCustomer(api, await publishableKey(), "somchai@example.com", PASSWORD)
      await setIdentityEmail("somchai@example.com", "Somchai@Example.COM")
      await customers().updateCustomers(customerId, { email: "Somchai@Example.COM" })
      const affiliate = await affiliates().createAffiliates({ email: "Ann@Example.COM", name: "Ann", code: "ann-core81" })
      return { customerId, affiliateId: affiliate.id, identityId: (await identityOf("Somchai@Example.COM")).id }
    }

    describe("dry-run and apply", () => {
      it("prints the rows without writing, applies through the workflow, then finds nothing", async () => {
        const seeded = await seedMixedCase()
        const before = await snapshot()
        expect(await status(api.post("/auth/customer/emailpass", { email: "somchai@example.com", password: PASSWORD }))).toBe(401)

        const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
        const info = jest.spyOn(logger, "info")
        await lowercaseEmailsScript({ container: getContainer(), args: [] })
        const printed = info.mock.calls.map(([line]) => String(line)).join("\n")
        info.mockRestore()

        for (const id of [seeded.identityId, seeded.customerId, seeded.affiliateId]) expect(printed).toContain(id)
        expect(printed).not.toContain("Somchai@Example.COM") // ไม่พิมพ์อีเมล (PII)
        const dry = await lowercaseEmails(getContainer(), false)
        expect(dry.applied).toBe(false)
        expect(Object.values(dry.plan).flatMap((table) => table.changes)).toHaveLength(3)
        expect(await snapshot()).toEqual(before)

        await lowercaseEmailsScript({ container: getContainer(), args: ["apply"] })

        expect(await snapshot()).toEqual({
          identities: ["somchai@example.com"],
          customers: ["somchai@example.com"],
          affiliates: ["ann@example.com"],
        })
        expect(await status(api.post("/auth/customer/emailpass", { email: "somchai@example.com", password: PASSWORD }))).toBe(200)

        const again = await lowercaseEmails(getContainer(), true)
        expect(again.applied).toBe(false)
        expect(Object.values(again.plan).flatMap((table) => [...table.changes, ...table.collisions])).toEqual([])
      })

      it("converts affiliate identities but never admin identities (Q-C13 = ก)", async () => {
        const { data } = await api.post("/auth/affiliate/emailpass/register", { email: "ann@example.com", password: PASSWORD })
        await api.post(
          "/affiliate/register",
          { name: "Ann", code: "ann-core81" },
          { headers: { authorization: `Bearer ${data.token}` } }
        )
        await setIdentityEmail("ann@example.com", "Ann@Example.COM")
        await affiliates().updateAffiliates({ selector: { email: "ann@example.com" }, data: { email: "Ann@Example.COM" } })
        await createAdminUser(getContainer(), "Boss@Example.COM")

        await lowercaseEmailsScript({ container: getContainer(), args: ["--apply"] })

        expect((await snapshot()).identities).toEqual(["Boss@Example.COM", "ann@example.com"])
        expect((await snapshot()).affiliates).toEqual(["ann@example.com"])
        expect(await status(api.post("/auth/affiliate/emailpass", { email: "ann@example.com", password: PASSWORD }))).toBe(200)
      })
    })

    describe("collisions", () => {
      it("stops with a non-zero exit and changes nothing under each unique index", async () => {
        const key = await publishableKey()
        // (entity_id, provider): ลูกค้าสองคน และลูกค้าชนกับแอดมิน
        await registerCustomer(api, key, "pair@x.co", PASSWORD)
        await registerCustomer(api, key, "other@x.co", PASSWORD)
        await setIdentityEmail("other@x.co", "PAIR@x.co")
        await createAdminUser(getContainer(), "boss@x.co")
        await registerCustomer(api, key, "boss-customer@x.co", PASSWORD)
        await setIdentityEmail("boss-customer@x.co", "BOSS@x.co")
        // (email, has_account): ชนเมื่อ has_account เท่ากันเท่านั้น
        const [twinA, twinB] = await customers().createCustomers([
          { email: "Twin@x.co", has_account: true },
          { email: "twin@x.co", has_account: true },
        ])
        await customers().createCustomers([
          { email: "Solo@x.co", has_account: false },
          { email: "solo@x.co", has_account: true },
        ])
        // affiliate.email
        const [affA, affB] = await affiliates().createAffiliates([
          { email: "Aff@x.co", name: "A", code: "aff-a" },
          { email: "aff@x.co", name: "B", code: "aff-b" },
        ])
        const before = await snapshot()

        const result = await lowercaseEmails(getContainer(), true)

        expect(result.applied).toBe(false)
        expect(result.plan.provider_identities.collisions).toHaveLength(2)
        expect(result.plan.customers.collisions.map((ids) => [...ids].sort())).toEqual([[twinA.id, twinB.id].sort()])
        expect(result.plan.affiliates.collisions.map((ids) => [...ids].sort())).toEqual([[affA.id, affB.id].sort()])
        await expect(lowercaseEmailsScript({ container: getContainer(), args: ["apply"] })).rejects.toThrow(/ชน|ตัวพิมพ์/)
        expect(await snapshot()).toEqual(before)
      })
    })

    describe("soft-deleted identities", () => {
      // IDX_provider_identity_provider_entity_id ไม่ใช่ partial index — แถวที่ soft-delete แล้วยังชนได้ตอน apply
      it("counts them when checking collisions without converting them", async () => {
        await auth().createAuthIdentities([
          { provider_identities: [{ provider: "emailpass", entity_id: "ghost@x.co" }], app_metadata: { customer_id: "cus_ghost" } },
          { provider_identities: [{ provider: "emailpass", entity_id: "Ghost@x.co" }], app_metadata: { customer_id: "cus_live" } },
        ])
        const deletedId = (await identityOf("ghost@x.co")).id
        const liveId = (await identityOf("Ghost@x.co")).id
        await (auth() as unknown as { softDeleteProviderIdentities: (ids: string[]) => Promise<unknown> }).softDeleteProviderIdentities([
          deletedId,
        ])

        const result = await lowercaseEmails(getContainer(), true)

        expect(result.applied).toBe(false)
        expect(result.plan.provider_identities.changes.map((c) => c.id)).toEqual([liveId])
        expect(result.plan.provider_identities.collisions.map((ids) => [...ids].sort())).toEqual([[deletedId, liveId].sort()])
        expect((await identityOf("Ghost@x.co")).id).toBe(liveId)
      })
    })

    describe("unique violation during apply", () => {
      // มีคนสมัครแทรกระหว่าง plan กับ apply: error ของ DB มีอีเมล — script ต้องโยนข้อความที่มีแค่ตาราง/id
      const printedBy = (calls: unknown[][]) => calls.map((args) => args.map(String).join(" ")).join("\n")

      it.each([
        [
          "provider_identities",
          "listProviderIdentities",
          async () => {
            const { customerId } = await registerCustomer(api, await publishableKey(), "race@x.co", PASSWORD)
            await setIdentityEmail("race@x.co", "Race@X.co")
            await customers().updateCustomers(customerId, { email: "race-customer@x.co" })
            return (await identityOf("Race@X.co")).id
          },
          () => auth().createAuthIdentities({
            provider_identities: [{ provider: "emailpass", entity_id: "race@x.co" }],
            app_metadata: { customer_id: "cus_race_other" },
          }),
        ],
        [
          "customers",
          "listCustomers",
          async () => (await customers().createCustomers({ email: "Race@X.co", has_account: true })).id,
          () => customers().createCustomers({ email: "race@x.co", has_account: true }),
        ],
      ] as const)("%s: rethrows without the email", async (table, listMethod, seed, signUpInBetween) => {
        const id = await seed()
        const service = (table === "customers" ? customers() : auth()) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
        const proto = Object.getPrototypeOf(service)
        const original = proto[listMethod]
        const list = jest.spyOn(proto, listMethod).mockImplementationOnce(async function (this: unknown, ...args: unknown[]) {
          const rows = await original.apply(this, args)
          await signUpInBetween()
          return rows
        })
        const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
        const spies = (["error", "warn", "info"] as const).map((level) => jest.spyOn(logger, level))

        const error = await lowercaseEmailsScript({ container: getContainer(), args: ["apply"] }).then(
          () => undefined,
          (e: { message?: string; stack?: string }) => e
        )
        list.mockRestore()
        const logged = spies.map((spy) => printedBy(spy.mock.calls)).join("\n")
        spies.forEach((spy) => spy.mockRestore())

        expect(error?.message).toContain(table)
        expect(error?.message).toContain(id)
        const visible = `${error?.message} ${error?.stack ?? ""} ${JSON.stringify(error)} ${logged}`.toLowerCase()
        expect(visible).not.toContain("race@x.co")
        const snap = await snapshot()
        expect(table === "customers" ? snap.customers : snap.identities).toEqual(expect.arrayContaining(["Race@X.co", "race@x.co"]))
      })
    })

    describe("compensation", () => {
      it("restores every original value when the second step fails", async () => {
        await seedMixedCase()
        const before = await snapshot()
        // step resolve service จาก container ของ workflow (คนละ object กับที่ test ถือ) — mock ที่ prototype ของ service
        const update = jest
          .spyOn(Object.getPrototypeOf(customers()), "updateCustomers")
          .mockRejectedValueOnce(new Error("core-81 boom"))

        // workflow engine โยน error ของ step เป็น object ที่ serialize แล้ว (ไม่ใช่ instance ของ Error)
        await expect(lowercaseEmails(getContainer(), true)).rejects.toMatchObject({ message: "core-81 boom" })
        expect(update).toHaveBeenCalledTimes(1)
        update.mockRestore()

        expect(await snapshot()).toEqual(before)
      })
    })
  },
})
