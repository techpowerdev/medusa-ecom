import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"
import AffiliateModuleService from "../../src/modules/affiliate/service"

jest.setTimeout(120 * 1000)

const DAY = 24 * 60 * 60 * 1000

// fail fast with a readable reason instead of hanging until the suite timeout
const within = async <T>(promise: Promise<T>, ms: number, reason: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${reason}`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// AF-5: admin API ของ affiliate + payout workflows (AC-7, Q8)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let service: AffiliateModuleService

    beforeEach(async () => {
      const container = getContainer()
      service = container.resolve(AFFILIATE_MODULE)

      const user = await container
        .resolve(Modules.USER)
        .createUsers({ email: "admin@example.com" })
      const identity = await container.resolve(Modules.AUTH).createAuthIdentities({
        provider_identities: [{ provider: "emailpass", entity_id: "admin@example.com" }],
        app_metadata: { user_id: user.id },
      })
      const { http } = container.resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      ).projectConfig
      const token = generateJwtToken(
        {
          actor_id: user.id,
          actor_type: "user",
          auth_identity_id: identity.id,
          app_metadata: { user_id: user.id },
        },
        { secret: http.jwtSecret, expiresIn: "1d" }
      )
      headers = { authorization: `Bearer ${token}` }
    })

    const createAffiliate = (code: string, status = "active") =>
      service.createAffiliates({
        email: `${code}@example.com`,
        name: code,
        code,
        status: status as "active",
      })

    const programBody = {
      name: "Summer",
      starts_at: new Date(Date.now() + DAY).toISOString(),
      ends_at: new Date(Date.now() + 10 * DAY).toISOString(),
      commission_value: 10,
      scope: { collection_ids: ["pcol_1"] },
    }

    it("requires an admin user", async () => {
      const response = await api
        .get("/admin/affiliate/programs")
        .catch((e) => e.response)
      expect(response.status).toEqual(401)
    })

    describe("programs CRUD", () => {
      it("creates a draft program, lists, publishes and ends it", async () => {
        const created = await api.post("/admin/affiliate/programs", programBody, { headers })
        expect(created.status).toEqual(200)
        expect(created.data.program).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: "Summer",
            status: "draft",
            commission_type: "percentage",
            commission_value: 10,
            attribution_window_days: 7,
            hold_days: 14,
            scope: { collection_ids: ["pcol_1"] },
          })
        )
        const id = created.data.program.id

        const list = await api.get("/admin/affiliate/programs", { headers })
        expect(list.data.count).toEqual(1)
        expect(list.data.programs[0].id).toEqual(id)

        const published = await api.post(
          `/admin/affiliate/programs/${id}`,
          { status: "published", cap_per_order: 500 },
          { headers }
        )
        expect(published.data.program).toEqual(
          expect.objectContaining({ status: "published", cap_per_order: 500 })
        )

        const ended = await api.post(
          `/admin/affiliate/programs/${id}`,
          { status: "ended" },
          { headers }
        )
        expect(ended.data.program.status).toEqual("ended")

        const reopen = await api
          .post(`/admin/affiliate/programs/${id}`, { status: "published" }, { headers })
          .catch((e) => e.response)
        expect(reopen.status).toEqual(400)

        const fetched = await api.get(`/admin/affiliate/programs/${id}`, { headers })
        expect(fetched.data.program.status).toEqual("ended")

        const missing = await api
          .get("/admin/affiliate/programs/affprog_missing", { headers })
          .catch((e) => e.response)
        expect(missing.status).toEqual(404)
      })

      it("rejects an invalid window or rate", async () => {
        const badWindow = await api
          .post(
            "/admin/affiliate/programs",
            { ...programBody, ends_at: programBody.starts_at },
            { headers }
          )
          .catch((e) => e.response)
        expect(badWindow.status).toEqual(400)

        const badRate = await api
          .post(
            "/admin/affiliate/programs",
            { ...programBody, commission_value: 101 },
            { headers }
          )
          .catch((e) => e.response)
        expect(badRate.status).toEqual(400)
      })

      it("deletes only draft programs", async () => {
        const draft = await api.post("/admin/affiliate/programs", programBody, { headers })
        const deleted = await api.delete(
          `/admin/affiliate/programs/${draft.data.program.id}`,
          { headers }
        )
        expect(deleted.data).toEqual({
          id: draft.data.program.id,
          object: "affiliate_program",
          deleted: true,
        })

        const published = await api.post(
          "/admin/affiliate/programs",
          { ...programBody, status: "published" },
          { headers }
        )
        const refused = await api
          .delete(`/admin/affiliate/programs/${published.data.program.id}`, { headers })
          .catch((e) => e.response)
        expect(refused.status).toEqual(400)
      })
    })

    describe("affiliates", () => {
      it("lists by status, approves, suspends and sets payout_info", async () => {
        const ann = await createAffiliate("ann", "pending")
        await createAffiliate("bob", "active")

        const pending = await api.get("/admin/affiliate/affiliates?status=pending", {
          headers,
        })
        expect(pending.data.affiliates.map((a) => a.code)).toEqual(["ann"])

        const approved = await api.post(
          `/admin/affiliate/affiliates/${ann.id}`,
          { status: "active", payout_info: { bank: "KBank", account: "123" } },
          { headers }
        )
        expect(approved.data.affiliate).toEqual(
          expect.objectContaining({
            status: "active",
            payout_info: { bank: "KBank", account: "123" },
          })
        )

        const suspended = await api.post(
          `/admin/affiliate/affiliates/${ann.id}`,
          { status: "suspended" },
          { headers }
        )
        expect(suspended.data.affiliate.status).toEqual("suspended")

        const badBody = await api
          .post(`/admin/affiliate/affiliates/${ann.id}`, { email: "x@y.com" }, { headers })
          .catch((e) => e.response)
        expect(badBody.status).toEqual(400)
      })

      // AF-14 (กฎ 38): admin UI ดึงชื่อ/อีเมลของ affiliate ในหน้าปัจจุบันด้วย id[] ครั้งเดียวต่อหน้า
      it("filters by id or id[] (AC-45)", async () => {
        const a = await createAffiliate("ann")
        const b = await createAffiliate("bob")
        await createAffiliate("cat")

        const many = await api.get(
          `/admin/affiliate/affiliates?id[]=${a.id}&id[]=${b.id}&fields=id,name,email&limit=2`,
          { headers }
        )
        expect(many.data.count).toEqual(2)
        expect(many.data.affiliates).toEqual(
          expect.arrayContaining([
            { id: a.id, name: "ann", email: "ann@example.com" },
            { id: b.id, name: "bob", email: "bob@example.com" },
          ])
        )
        expect(many.data.affiliates).toHaveLength(2)

        // รูปแบบ qs ของ JS SDK (id[0]=…&id[1]=…)
        const indexed = await api.get(
          `/admin/affiliate/affiliates?id[0]=${a.id}&id[1]=${b.id}`,
          { headers }
        )
        expect(indexed.data.count).toEqual(2)

        const one = await api.get(`/admin/affiliate/affiliates?id=${a.id}`, { headers })
        expect(one.data.affiliates.map((x) => x.id)).toEqual([a.id])
        expect(one.data.count).toEqual(1)

        const anonymous = await api
          .get(`/admin/affiliate/affiliates?id[]=${a.id}`)
          .catch((e) => e.response)
        expect(anonymous.status).toEqual(401)
      })
    })

    describe("ledger, payouts and summary (AC-7)", () => {
      const now = new Date()
      const lastMonthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      const thisMonthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const lastMonthMid = new Date(lastMonthFrom.getTime() + 10 * DAY)
      const twoMonthsAgo = new Date(lastMonthFrom.getTime() - 10 * DAY)

      let annId: string
      let bobId: string

      const entry = (
        affiliate_id: string,
        amount: number,
        status: "pending" | "approved" | "reversed" | "paid",
        created_at: Date,
        order_id: string
      ) => ({
        affiliate_id,
        program_id: "affprog_1",
        order_id,
        line_item_id: `li_${order_id}`,
        amount,
        currency: "thb",
        status,
        created_at,
      })

      beforeEach(async () => {
        annId = (await createAffiliate("ann")).id
        bobId = (await createAffiliate("bob")).id
        await service.createAffiliateCommissionEntries([
          entry(annId, 100, "approved", lastMonthMid, "o1"),
          entry(annId, 50, "approved", lastMonthMid, "o2"),
          entry(annId, -30, "reversed", lastMonthMid, "o2"),
          entry(annId, 20, "pending", lastMonthMid, "o3"),
          // carried over from an earlier period that was never paid (Q8)
          entry(annId, 5, "approved", twoMonthsAgo, "o0"),
          // after the period end → next payout
          entry(annId, 70, "approved", new Date(thisMonthFrom.getTime() + 1000), "o4"),
          entry(bobId, 999, "approved", lastMonthMid, "o5"),
        ])
      })

      const period = () => ({
        affiliate_id: annId,
        period_from: lastMonthFrom.toISOString(),
        period_to: thisMonthFrom.toISOString(),
      })

      it("lists ledger entries filtered by affiliate and status", async () => {
        const response = await api.get(
          `/admin/affiliate/entries?affiliate_id=${annId}&status=approved`,
          { headers }
        )
        expect(response.data.count).toEqual(4)
        expect(
          response.data.entries.every(
            (e) => e.affiliate_id === annId && e.status === "approved"
          )
        ).toBe(true)

        // newest first by default; limit is capped
        const all = await api.get(`/admin/affiliate/entries?affiliate_id=${annId}`, { headers })
        const createdAt = all.data.entries.map((e) => new Date(e.created_at).getTime())
        expect(createdAt).toEqual([...createdAt].sort((a, b) => b - a))
        const tooMany = await api
          .get("/admin/affiliate/entries?limit=500", { headers })
          .catch((e) => e.response)
        expect(tooMany.status).toEqual(400)
      })

      it("creates a draft payout of approved + reversed entries, then marks it paid", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        expect(created.status).toEqual(200)
        const payout = created.data.payout
        expect(payout).toEqual(
          expect.objectContaining({
            affiliate_id: annId,
            amount: 125,
            currency: "thb",
            status: "draft",
            paid_at: null,
          })
        )
        expect(payout.entry_ids).toHaveLength(4)

        // entries already in a payout are not taken again
        const again = await api
          .post("/admin/affiliate/payouts", period(), { headers })
          .catch((e) => e.response)
        expect(again.status).toEqual(400)

        const paid = await api.post(
          `/admin/affiliate/payouts/${payout.id}/mark-paid`,
          { reference: "KBANK-0001" },
          { headers }
        )
        expect(paid.data.payout).toEqual(
          expect.objectContaining({
            status: "paid",
            reference: "KBANK-0001",
            paid_at: expect.any(String),
          })
        )

        const entries = await service.listAffiliateCommissionEntries({ id: payout.entry_ids })
        const statuses = entries.map((e) => [Number(e.amount), e.status]).sort()
        expect(statuses).toEqual(
          [
            [-30, "reversed"],
            [100, "paid"],
            [5, "paid"],
            [50, "paid"],
          ].sort()
        )
        const [pending] = await service.listAffiliateCommissionEntries({ order_id: "o3" })
        expect(pending.status).toEqual("pending")

        const twice = await api
          .post(`/admin/affiliate/payouts/${payout.id}/mark-paid`, {}, { headers })
          .catch((e) => e.response)
        expect(twice.status).toEqual(400)

        const list = await api.get(`/admin/affiliate/payouts?affiliate_id=${annId}`, {
          headers,
        })
        expect(list.data.payouts.map((p) => p.id)).toEqual([payout.id])
      })

      it("rolls entries back to approved when marking the payout paid fails", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        const payout = created.data.payout

        // fail setAffiliatePayoutPaidStep after entries were already moved to paid
        const spy = jest
          .spyOn(service, "updateAffiliatePayouts")
          .mockRejectedValueOnce(new Error("bank reference store failed"))
        const failed = await api
          .post(`/admin/affiliate/payouts/${payout.id}/mark-paid`, {}, { headers })
          .catch((e) => e.response)
        spy.mockRestore()
        expect(failed.status).toBeGreaterThanOrEqual(400)

        const entries = await service.listAffiliateCommissionEntries({ id: payout.entry_ids })
        expect(entries.filter((e) => e.status === "paid")).toHaveLength(0)
        expect(entries.filter((e) => e.status === "approved")).toHaveLength(3)
        const after = await service.retrieveAffiliatePayout(payout.id)
        expect(after.status).toEqual("draft")
        expect(after.paid_at).toBeNull()
      })

      it("exposes ledger and payouts through Query", async () => {
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: entries } = await query.graph({
          entity: "affiliate_commission_entry",
          fields: ["id", "status"],
          filters: { affiliate_id: annId },
        })
        expect(entries).toHaveLength(6)
        const { data: payouts } = await query.graph({
          entity: "affiliate_payout",
          fields: ["id"],
          filters: { affiliate_id: annId },
        })
        expect(payouts).toHaveLength(0)
      })

      it("serializes concurrent payout creation so entries are paid out once", async () => {
        const results = await Promise.all([
          api.post("/admin/affiliate/payouts", period(), { headers }).catch((e) => e.response),
          api.post("/admin/affiliate/payouts", period(), { headers }).catch((e) => e.response),
        ])
        expect(results.map((r) => r.status).sort()).toEqual([200, 400])
        expect(await service.listAffiliatePayouts({ affiliate_id: annId })).toHaveLength(1)
      })

      it("does not create a payout when the net is zero or negative (Q8)", async () => {
        const carol = (await createAffiliate("carol")).id
        await service.createAffiliateCommissionEntries([
          entry(carol, 40, "approved", lastMonthMid, "o6"),
          entry(carol, -40, "reversed", lastMonthMid, "o6"),
        ])

        const response = await api
          .post("/admin/affiliate/payouts", { ...period(), affiliate_id: carol }, { headers })
          .catch((e) => e.response)
        expect(response.status).toEqual(400)
        expect(await service.listAffiliatePayouts({ affiliate_id: carol })).toHaveLength(0)
      })

      // AF-9 (AC-19, Q9): ยกเลิก payout draft = soft-delete; entry ไม่เปลี่ยนสถานะและกลับไปเลือกได้อีก
      it("cancels a draft payout and returns its entries to the pool (AC-19)", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        const payout = created.data.payout
        const before = await service.listAffiliateCommissionEntries({ id: payout.entry_ids })

        const cancelled = await api.delete(`/admin/affiliate/payouts/${payout.id}`, { headers })
        expect(cancelled.status).toEqual(200)
        expect(cancelled.data).toEqual({ id: payout.id, object: "affiliate_payout", deleted: true })

        const list = await api.get(`/admin/affiliate/payouts?affiliate_id=${annId}`, { headers })
        expect(list.data.payouts).toEqual([])
        const gone = await api
          .get(`/admin/affiliate/payouts/${payout.id}`, { headers })
          .catch((e) => e.response)
        expect(gone.status).toEqual(404)

        const after = await service.listAffiliateCommissionEntries({ id: payout.entry_ids })
        const statusById = (rows: { id: string; status: string }[]) =>
          Object.fromEntries(rows.map((e) => [e.id, e.status]))
        expect(statusById(after)).toEqual(statusById(before))

        const recreated = await api.post("/admin/affiliate/payouts", period(), { headers })
        expect(recreated.status).toEqual(200)
        expect(recreated.data.payout.amount).toEqual(payout.amount)
        expect([...recreated.data.payout.entry_ids].sort()).toEqual([...payout.entry_ids].sort())
      })

      it("refuses to cancel a paid payout and leaves it unchanged (AC-19)", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        const payout = created.data.payout
        await api.post(`/admin/affiliate/payouts/${payout.id}/mark-paid`, {}, { headers })

        const refused = await api
          .delete(`/admin/affiliate/payouts/${payout.id}`, { headers })
          .catch((e) => e.response)
        expect(refused.status).toEqual(400)

        const still = await api.get(`/admin/affiliate/payouts/${payout.id}`, { headers })
        expect(still.data.payout).toEqual(
          expect.objectContaining({ status: "paid", amount: payout.amount })
        )
        const entries = await service.listAffiliateCommissionEntries({ id: payout.entry_ids })
        expect(entries.filter((e) => e.status === "paid")).toHaveLength(3)

        const missing = await api
          .delete("/admin/affiliate/payouts/affpay_missing", { headers })
          .catch((e) => e.response)
        expect(missing.status).toEqual(404)
      })

      // AF-9b (AC-27, กฎ 25): cancel ถือ lock affiliate → payout-paid จนจบ compensation
      it("holds the affiliate payout lock through cancel compensation (AC-27)", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        const draft = created.data.payout
        const affiliateKey = `affiliate-payout:${annId}`
        const paidKey = `affiliate-payout-paid:${draft.id}`

        const locking = getContainer().resolve(Modules.LOCKING)
        const acquired: string[][] = []
        const originalAcquire = locking.acquire.bind(locking)
        const originalRelease = locking.release.bind(locking)

        let openGate!: () => void
        const gate = new Promise<void>((resolve) => (openGate = resolve))
        let cancelHolding!: () => void
        const holding = new Promise<void>((resolve) => (cancelHolding = resolve))
        let createWaiting!: () => void
        const waiting = new Promise<void>((resolve) => (createWaiting = resolve))
        let injected = false

        const acquireSpy = jest
          .spyOn(locking, "acquire")
          .mockImplementation(async (keys: string | string[], args?: any) => {
            const list = Array.isArray(keys) ? keys : [keys]
            acquired.push(list)
            if (injected && list.includes(affiliateKey)) {
              createWaiting()
            }
            return originalAcquire(keys, args)
          })
        // inject: the release step runs after the soft-delete → fail it while create is waiting
        const releaseSpy = jest
          .spyOn(locking, "release")
          .mockImplementation(async (keys: string | string[], args?: any) => {
            const list = Array.isArray(keys) ? keys : [keys]
            if (!injected && list.includes(paidKey)) {
              injected = true
              cancelHolding()
              await gate
              throw new Error("injected failure after soft-delete")
            }
            return originalRelease(keys, args)
          })

        try {
          const cancel = api
            .delete(`/admin/affiliate/payouts/${draft.id}`, { headers })
            .catch((e) => e.response)
          await within(
            holding,
            30_000,
            `cancel never reached the release of ${paidKey} (lock order or step changed?)`
          )
          expect(await service.listAffiliatePayouts({ id: draft.id })).toHaveLength(0)

          const create = api
            .post("/admin/affiliate/payouts", period(), { headers })
            .catch((e) => e.response)
          await within(
            waiting,
            30_000,
            `create never asked for ${affiliateKey} while cancel held it`
          )
          // give an unblocked create time to finish while D is still soft-deleted
          await Promise.race([create, new Promise((r) => setTimeout(r, 1000))])
          openGate()

          const [cancelled, recreated] = await Promise.all([cancel, create])
          expect(cancelled.status).toEqual(500)
          expect(recreated.status).toEqual(400)
        } finally {
          acquireSpy.mockRestore()
          releaseSpy.mockRestore()
          openGate()
        }

        // cancel asks affiliate key first, then payout-paid key (rule 25)
        const cancelKeys = acquired
          .flat()
          .filter((k) => k === affiliateKey || k === paidKey)
        expect(cancelKeys.slice(0, 2)).toEqual([affiliateKey, paidKey])

        const restored = await service.retrieveAffiliatePayout(draft.id)
        expect(restored.status).toEqual("draft")
        const live = await service.listAffiliatePayouts({ affiliate_id: annId })
        const ids = live.flatMap((p) => p.entry_ids as string[])
        expect(new Set(ids).size).toEqual(ids.length)
      })

      it("rejects cancelling a payout without an admin token (AC-27)", async () => {
        const created = await api.post("/admin/affiliate/payouts", period(), { headers })
        const payout = created.data.payout

        const response = await api
          .delete(`/admin/affiliate/payouts/${payout.id}`)
          .catch((e) => e.response)
        expect(response.status).toEqual(401)

        const still = await service.retrieveAffiliatePayout(payout.id)
        expect(still).toEqual(expect.objectContaining({ status: "draft", amount: payout.amount }))
      })

      // AF-9 (AC-20, กฎ 19): ไม่ตัดด้วย period_from, ตัดด้วย period_to และ entry_ids ของ payout อื่น
      it("selects entries by rule 19 across payout rounds (AC-20)", async () => {
        const earlier = await api.post(
          "/admin/affiliate/payouts",
          {
            affiliate_id: annId,
            period_from: new Date(lastMonthFrom.getTime() - 30 * DAY).toISOString(),
            period_to: lastMonthFrom.toISOString(),
          },
          { headers }
        )
        expect(earlier.data.payout.amount).toEqual(5)
        expect(earlier.data.payout.entry_ids).toHaveLength(1)

        const current = await api.post("/admin/affiliate/payouts", period(), { headers })
        expect(current.data.payout.amount).toEqual(120)
        expect(current.data.payout.entry_ids).toHaveLength(3)
        expect(current.data.payout.entry_ids).not.toContain(earlier.data.payout.entry_ids[0])
      })

      it("filters payable entries in the database (rule 19)", async () => {
        const [o1] = await service.listAffiliateCommissionEntries({ order_id: "o1" })
        const [o0] = await service.listAffiliateCommissionEntries({ order_id: "o0" })
        const base = {
          affiliate_id: annId,
          currency: "thb",
          period_from: lastMonthFrom,
          period_to: thisMonthFrom,
        }
        await service.createAffiliatePayouts({ ...base, amount: 100, entry_ids: [o1.id] })
        const cancelled = await service.createAffiliatePayouts({
          ...base,
          amount: 5,
          entry_ids: [o0.id],
        })
        await service.softDeleteAffiliatePayouts(cancelled.id)

        const payable = await service.listPayableCommissionEntries({
          affiliate_id: annId,
          period_to: thisMonthFrom,
        })
        expect(payable.map((e) => [Number(e.amount), e.status]).sort()).toEqual(
          [
            [5, "approved"],
            [50, "approved"],
            [-30, "reversed"],
          ].sort()
        )
        expect(payable.every((e) => e.currency === "thb")).toBe(true)
      })

      it("summarizes the ledger per affiliate and status", async () => {
        const response = await api.get(
          `/admin/affiliate/reports/summary?from=${lastMonthFrom.toISOString()}&to=${thisMonthFrom.toISOString()}`,
          { headers }
        )
        expect(response.status).toEqual(200)
        expect(response.data.summary).toEqual(
          expect.arrayContaining([
            { affiliate_id: annId, currency: "thb", status: "approved", amount: 150, count: 2 },
            { affiliate_id: annId, currency: "thb", status: "reversed", amount: -30, count: 1 },
            { affiliate_id: annId, currency: "thb", status: "pending", amount: 20, count: 1 },
            { affiliate_id: bobId, currency: "thb", status: "approved", amount: 999, count: 1 },
          ])
        )
        expect(response.data.summary).toHaveLength(4)
      })
    })
  },
})
