import { readFileSync } from "fs"
import path from "path"
import { classifyRefund, REFUND_FAILED, REFUND_STUCK } from "../refund-alerts"

// PAY-20 (spec 06 กฎข้อ 22b, AC-33e): จัดประเภทแถว refund + ยอดของ payment → code ของ alert (pure, MathBN จาก raw_amount)
const raw = (value: string, deleted_at: string | null = null) => ({ raw_amount: { value, precision: 20 }, deleted_at })
const now = new Date("2026-11-24T12:00:00Z")
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)
const payment = (captures: string[], refunds: ReturnType<typeof raw>[] = []) => ({ captures: captures.map((c) => raw(c)), refunds })

describe("classifyRefund (กฎข้อ 22b)", () => {
  it.each([
    ["failed (soft-deleted), nothing refunded → REFUND_FAILED", { status: "failed", deleted_at: now, updated_at: now }, payment(["500"]), REFUND_FAILED],
    ["failed, not deleted, remaining > 0 → REFUND_FAILED", { status: "failed", deleted_at: null, updated_at: now }, payment(["500"]), REFUND_FAILED],
    ["failed then refunded in full later → null", { status: "failed", deleted_at: now, updated_at: now }, payment(["500"], [raw("500")]), null],
    ["failed, partial refund later still leaves money → REFUND_FAILED", { status: "failed", deleted_at: now, updated_at: now }, payment(["500"], [raw("200")]), REFUND_FAILED],
    ["decimal 100.10 + 200.20 = capture 300.30 (MathBN, not float) → null", { status: "failed", deleted_at: now, updated_at: now }, payment(["300.30"], [raw("100.10"), raw("200.20")]), null],
    ["soft-deleted refunds are not counted as refunded", { status: "failed", deleted_at: now, updated_at: now }, payment(["500"], [raw("500", now.toISOString())]), REFUND_FAILED],
    ["failed but the payment was never captured → null", { status: "failed", deleted_at: now, updated_at: now }, payment([]), null],
    ["pending 61 minutes → REFUND_STUCK", { status: "pending", deleted_at: null, updated_at: minutesAgo(61) }, payment(["500"], [raw("500")]), REFUND_STUCK],
    ["pending exactly 60 minutes → REFUND_STUCK", { status: "pending", deleted_at: null, updated_at: minutesAgo(60) }, payment(["500"]), REFUND_STUCK],
    ["pending 30 minutes → null", { status: "pending", deleted_at: null, updated_at: minutesAgo(30) }, payment(["500"]), null],
    ["pending but soft-deleted → null", { status: "pending", deleted_at: minutesAgo(90), updated_at: minutesAgo(90) }, payment(["500"]), null],
    ["succeeded → null", { status: "succeeded", deleted_at: null, updated_at: minutesAgo(600) }, payment(["500"], [raw("500")]), null],
  ])("%s", (_label, refund, pay, expected) => {
    expect(classifyRefund(refund as any, pay as any, now)).toBe(expected)
  })

  it("tolerates a missing payment / null relations from query.graph", () => {
    expect(classifyRefund({ status: "failed", deleted_at: now, updated_at: now }, null, now)).toBeNull()
    expect(classifyRefund({ status: "failed", deleted_at: now, updated_at: now }, { captures: null, refunds: null }, now)).toBeNull()
  })
})

// AC-33e static: job และ helper อ่านอย่างเดียวผ่าน Medusa — ไม่ import stripe
describe("PAY-20 sources do not import stripe", () => {
  it.each(["src/jobs/refund-failure-scan.ts", "src/lib/ops-alert.ts", "src/lib/refund-alerts.ts"])("%s", (file) => {
    const source = readFileSync(path.resolve(__dirname, "../../..", file), "utf8")
    expect(source).not.toMatch(/from\s+["']stripe["']|require\(\s*["']stripe["']\s*\)/)
  })
})
