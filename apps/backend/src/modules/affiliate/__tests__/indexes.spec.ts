import path from "node:path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { AFFILIATE_MODULE } from ".."
import Affiliate from "../models/affiliate"
import AffiliateAttribution from "../models/affiliate-attribution"
import AffiliateProgram from "../models/affiliate-program"
import CommissionEntry from "../models/commission-entry"
import Payout from "../models/payout"
import AffiliateModuleService from "../service"

jest.setTimeout(60 * 1000)

// OPS-5 (spec 07 Deliverables ข้อ 4): ledger ถูกค้นด้วย order_id ทุกสถานะ — reverse-commission (`{ order_id }`),
// maturity job (`status: "reversed", order_id: [...]`) และ EXISTS ของ payout — index เดิม (order_id, line_item_id)
// เป็น partial `WHERE status = 'pending'` จึงใช้กับ query เหล่านี้ไม่ได้ (Parallel Seq Scan ที่ 200k แถว)
// รัน migration จริงของ module (pathToMigrations) เพื่อยืนยันว่า migration ตรงกับ model
moduleIntegrationTestRunner<AffiliateModuleService>({
  moduleName: AFFILIATE_MODULE,
  moduleModels: [Affiliate, AffiliateAttribution, AffiliateProgram, CommissionEntry, Payout],
  resolve: "./src/modules/affiliate",
  pathToMigrations: path.join(__dirname, "../migrations"),
  testSuite: ({ MikroOrmWrapper }) => {
    const execute = <T>(sql: string): Promise<T[]> =>
      MikroOrmWrapper.getManager().getConnection().execute(sql)

    it("has a non-partial order_id index on affiliate_commission_entry", async () => {
      const rows = await execute<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'affiliate_commission_entry'`
      )
      expect(rows.some((r) => /\(order_id\) WHERE \(deleted_at IS NULL\)$/.test(r.indexdef))).toBe(true)
    })

    it("serves ledger lookups by order_id of any status with an index condition", async () => {
      // ตารางว่าง planner เลือก seq scan เสมอ — ปิด seq scan เฉพาะ transaction นี้เพื่อดูว่ามี index ที่ใช้ได้
      const rows = await MikroOrmWrapper.getManager()
        .fork()
        .transactional(async (em) => {
          await em.execute(`SET LOCAL enable_seqscan = off`)
          return em.execute<{ "QUERY PLAN": string }[]>(
            `EXPLAIN SELECT id FROM affiliate_commission_entry
             WHERE status = 'reversed' AND order_id = 'order_1' AND deleted_at IS NULL`
          )
        })
      const plan = rows.map((r) => r["QUERY PLAN"]).join("\n")
      expect(plan).toMatch(/Index Cond: \(.*order_id = 'order_1'/)
    })
  },
})
