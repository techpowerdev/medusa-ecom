import { readFileSync } from "fs"
import path from "path"

// PAY-6b: spec 06 AC-16 (ADR-015 D) — runbook "เงินถูกตัดแต่ไม่มี order" และ env OPS_ALERT_EMAIL
const repoRoot = path.resolve(__dirname, "../../../..")
const RUNBOOK_TITLE = "เงินถูกตัดแต่ไม่มี order (ADR-015)"

/** เนื้อหาของหัวข้อ `## <title>` จนถึงหัวข้อระดับ 2 ถัดไป */
function section(markdown: string, title: string): string | null {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  if (start < 0) {
    return null
  }
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line))
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n")
}

describe("AC-16 runbook ใน docs/ops/production.md", () => {
  const doc = readFileSync(path.join(repoRoot, "docs/ops/production.md"), "utf8")
  const body = section(doc, RUNBOOK_TITLE)

  it(`มีหัวข้อ "${RUNBOOK_TITLE}"`, () => {
    expect(body).not.toBeNull()
  })

  it("อ้าง alert และ code ของ guard", () => {
    expect(body).toContain("PAYMENT_WEBHOOK_SESSION_NOT_FOUND")
    expect(body).toContain("PAYMENT_ALREADY_COMPLETED")
    expect(body).toContain("OPS_ALERT_EMAIL")
  })

  it("ระบุขั้นตอน: ค้น PI ใน Stripe dashboard, ยืนยันไม่มี order, refund เต็มจำนวน, แจ้งลูกค้า, บันทึก incident", () => {
    for (const step of ["Stripe dashboard", "ไม่มี order", "refund เต็มจำนวน", "แจ้งลูกค้า", "incident"]) {
      expect(body).toContain(step)
    }
  })

  it("มีกรณีไม่มี alert: ให้ลูกค้าเปิดหน้า checkout อีกครั้ง (storefront เรียก complete ตาม AC-12b)", () => {
    expect(body).toMatch(/### .*ไม่มี alert/)
    expect(body).toContain("checkout")
    expect(body).toContain("AC-12b")
  })

  it("กรณีไม่มี alert ที่ refund ใน Stripe: ปิดทางที่ cart จะถูก complete ทีหลัง (review #97)", () => {
    const noAlert = body!.slice(body!.search(/### .*ไม่มี alert/), body!.search(/### .*fail closed/))
    // ลูกค้าทิ้ง cart เดิม (logout ลบ cookie) ไม่ให้กดชำระแล้ว complete ด้วย payment ที่ refund แล้ว
    expect(noAlert).toContain("logout")
    // webhook ที่ Stripe retry ภายหลังอาจ complete cart → เฝ้า Orders จนพ้นช่วง retry
    expect(noAlert).toContain("retry")
    expect(noAlert).toContain("ห้าม fulfill")
    // cancelOrderWorkflow refund ผ่าน provider ซ้ำกับ PI ที่ refund แล้ว
    expect(noAlert).toContain("ห้าม cancel")
    expect(noAlert).toContain("cancelOrderWorkflow")
  })

  it("กรณีมี alert: ตรวจ Refunds ของ PI ก่อน และถ้าพบ payment ใน Medusa ให้ใช้ script ห้ามใช้ dashboard (review #97 r3)", () => {
    const alert = body!.slice(body!.search(/### มี alert/), body!.search(/### .*ไม่มี alert/))
    // PI ยังแสดง succeeded แม้ refund ครบแล้ว → ต้องดู Refunds ของ PI ก่อน
    expect(alert).toContain("Refunds ของ PI")
    // compensation ของ completeCartWorkflow อาจทิ้ง payment captured ไว้ (refund ล้มเงียบ) แล้วสร้าง session ใหม่
    expect(alert).toContain("payments ไม่ว่าง")
    expect(alert).toContain("ข้อ 3–4")
    expect(alert).toContain("ห้ามใช้ Stripe dashboard")
  })

  it("AC-16b กรณีไม่มี alert: ตรวจก่อน refund แล้ว refund ผ่าน script refund-orphan-payment ไม่ใช่ Stripe dashboard (ADR-015 ภาคผนวก 2)", () => {
    const noAlert = body!.slice(body!.search(/### .*ไม่มี alert/), body!.search(/### .*fail closed/))
    expect(noAlert).toMatch(/### .*payment captured แต่ collection ไม่ผูก order/)
    expect(noAlert).toContain("ตรวจก่อน refund")
    expect(noAlert).toContain("refund-orphan-payment")
    // note ของ refund ที่ compensatePaymentIfNeededStep สร้าง
    expect(noAlert).toContain("Refunded due to cart completion failure")
    // completeCartWorkflow refund เองเมื่อ complete ล้มหลัง capture → ต้องดู refunds ก่อน
    expect(noAlert).toContain("compensatePaymentIfNeededStep")
    expect(noAlert).toContain("GET /admin/payments/")
    expect(noAlert).toContain("medusa exec ./src/scripts/refund-orphan-payment.ts")
    expect(noAlert).toContain("ห้าม refund ใน Stripe dashboard")
    expect(noAlert).not.toContain("refund เต็มจำนวนใน Stripe dashboard")
    expect(body).not.toContain("ไม่มีโค้ดใดสร้าง order หรือ refund อัตโนมัติ")
  })

  it("มีหัวข้อย่อยกรณี guard fail closed ถาวร (retrieve PI ไม่ได้)", () => {
    expect(body).toMatch(/### .*fail closed/)
  })

  it("ไม่แนะนำแก้ DB ด้วย SQL ตรง", () => {
    expect(body).not.toMatch(/\b(DELETE FROM|UPDATE\s+\w+\s+SET|INSERT INTO)\b/i)
  })

  // GB-5 (review #185): เงินเข้าแต่ไม่มี order ของ group buy — alert เดียวกันทาง OPS_ALERT_EMAIL
  it("กรณี group buy: alert GROUP_BUY_PAID_WITHOUT_ORDER ทั้งสองสาเหตุ และขั้นตอนที่ admin ทำได้", () => {
    const gb = body!.slice(body!.search(/### group buy: เงินเข้าแต่ไม่มี order/))
    expect(gb).toContain("GROUP_BUY_PAID_WITHOUT_ORDER")
    for (const step of ["convert_failed", "membership_cancelled", "convert-to-order", "refund", "แจ้งลูกค้า", "incident"]) {
      expect(gb).toContain(step)
    }
  })
})

describe("AC-16 apps/backend/.env.example", () => {
  it("มีบรรทัด OPS_ALERT_EMAIL=", () => {
    const lines = readFileSync(path.join(repoRoot, "apps/backend/.env.example"), "utf8").split(/\r?\n/)
    expect(lines.filter((line) => /^OPS_ALERT_EMAIL=/.test(line))).toEqual(["OPS_ALERT_EMAIL="])
  })
})

// OPS-3: spec 07 AC-18 (ADR-012 ภาคผนวก) — alert จาก log เมื่อ BullMQ worker ของ event bus ตายตอนบูต
describe("AC-18 หัวข้อ Alerts ใน docs/ops/production.md", () => {
  const doc = readFileSync(path.join(repoRoot, "docs/ops/production.md"), "utf8")
  const body = section(doc, "Alerts")

  it('มีหัวข้อ "Alerts"', () => {
    expect(body).not.toBeNull()
  })

  it("มีกฎที่ match สตริง `Error running event bus worker` กรองด้วย level error และ worker_mode worker", () => {
    expect(body).toContain("Error running event bus worker")
    expect(body).toContain('level == "error"')
    expect(body).toContain('worker_mode == "worker"')
  })

  it("ระบุขั้นตอนตอบสนอง: restart worker", () => {
    expect(body).toContain("restart worker")
  })
})
