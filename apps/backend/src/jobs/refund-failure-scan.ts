import type { FilterableRefundProps, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, defineFileConfig, Modules, RefundStatus } from "@medusajs/framework/utils"
import { sendOpsAlert } from "../lib/ops-alert"
import { classifyRefund, type ScannedPayment } from "../lib/refund-alerts"
import { scheduledJobsDisabled } from "../lib/scheduled-jobs"
import { EmailTemplates } from "../modules/resend/templates"

// PAY-20 (spec 06 กฎข้อ 22, ADR-029 ก): refundPaymentsStep ของ Medusa 2.22.1 กลืน error ของ provider (log อย่างเดียว)
// แต่ Payment module เก็บแถว refund `failed` (soft-delete) และ `pending` ไว้ — ตรวจย้อนหลัง 7 วันแล้วแจ้ง ops
// อ่านอย่างเดียว: ไม่สร้าง/แก้ refund/payment/order ไม่เรียก Stripe — ops ทำตาม runbook "คืนเงินล้ม/ค้าง (ADR-029)"
export const REFUND_SCAN_LIMIT = 200
const LOOKBACK_MS = 7 * 24 * 60 * 60_000

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

// RefundDTO ของ 2.22.1 ไม่ประกาศ payment_id/deleted_at แต่ listRefunds คืน column เหล่านี้ตาม select
type RefundRow = {
  id: string
  status: string
  amount?: { toString(): string } | number | null
  payment_id: string
  note?: string | null
  updated_at: Date | string
  deleted_at?: Date | string | null
}

export async function scanRefundFailures(container: MedusaContainer, now: Date = new Date()): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentModule = container.resolve(Modules.PAYMENT)

  // status เป็น column ของ refund แต่ FilterableRefundProps ของ 2.22.1 ไม่ประกาศ
  const refunds = (await paymentModule.listRefunds(
    {
      status: [RefundStatus.FAILED, RefundStatus.PENDING],
      created_at: { $gte: new Date(now.getTime() - LOOKBACK_MS) },
    } as unknown as FilterableRefundProps,
    {
      select: ["id", "status", "amount", "raw_amount", "payment_id", "note", "created_at", "updated_at", "deleted_at"],
      withDeleted: true,
      take: REFUND_SCAN_LIMIT + 1,
      // PAY-23 (กฎข้อ 26c, Q-P23 = ก): ใหม่ก่อน — refund ที่เพิ่งล้มถูกแจ้งภายในรอบเสมอ แถวเก่าที่หลุดถูกแจ้งไปแล้วในรอบก่อน
      order: { created_at: "DESC" },
    }
  )) as unknown as RefundRow[]
  if (refunds.length > REFUND_SCAN_LIMIT) {
    // เรียงใหม่ก่อน (กฎข้อ 26c) → แถวที่เก่ากว่า 200 แถวล่าสุดไม่ถูกตรวจในรอบนี้ (ปกติถูกแจ้งไปแล้วในรอบก่อน)
    logger.warn(
      `REFUND_SCAN_TRUNCATED more than ${REFUND_SCAN_LIMIT} failed/pending refunds in 7 days — only the newest ` +
        `${REFUND_SCAN_LIMIT} are checked; check older refunds manually (runbook "คืนเงินล้ม/ค้าง (ADR-029)")`
    )
  }
  const rows = refunds.slice(0, REFUND_SCAN_LIMIT)
  if (!rows.length) {
    return
  }

  // ยอด captured/refunded (refund ที่ไม่ถูกลบ) + cart/order ของ payment — query.graph กรองแถวที่ soft-delete ออกเอง
  const { data: payments } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: [
      "id",
      "currency_code",
      "provider_id",
      "captures.raw_amount",
      "refunds.raw_amount",
      "refunds.deleted_at",
      "payment_collection.cart.id",
      "payment_collection.order.id",
    ],
    filters: { id: [...new Set(rows.map((r) => r.payment_id))] },
  })
  const byId = new Map(payments.map((p) => [p.id, p]))

  // แยก try ต่อแถว: แถวที่ล้มไม่ทำให้แถวอื่นไม่ถูกแจ้ง (job ไม่ throw)
  for (const refund of rows) {
    const payment = byId.get(refund.payment_id)
    const code = classifyRefund(refund, payment as ScannedPayment, now)
    if (!code) {
      continue
    }
    try {
      await sendOpsAlert(container, {
        code,
        template: EmailTemplates.REFUND_FAILED,
        idempotency_key: `refund-alert:${refund.id}`,
        resource_type: "payment",
        resource_id: refund.payment_id,
        data: {
          source: "medusa",
          refund_id: refund.id,
          payment_id: refund.payment_id,
          amount: refund.amount?.toString(),
          currency_code: payment?.currency_code ?? null,
          provider_id: payment?.provider_id ?? null,
          cart_id: payment?.payment_collection?.cart?.id ?? null,
          order_id: payment?.payment_collection?.order?.id ?? null,
          note: refund.note ?? null,
        },
      })
    } catch (error) {
      logger.error(`refund-failure-scan: failed to alert refund ${refund.id}: ${errorMessage(error)}`)
    }
  }
}

export default async function refundFailureScanJob(container: MedusaContainer) {
  await scanRefundFailures(container)
}

export const config = {
  name: "refund-failure-scan",
  schedule: "*/15 * * * *",
}

// OPS-15b (spec 07 AC-26): ไม่ลงทะเบียน cron ใน integration test — ดู src/lib/scheduled-jobs.ts
defineFileConfig({ isDisabled: () => scheduledJobsDisabled() })
