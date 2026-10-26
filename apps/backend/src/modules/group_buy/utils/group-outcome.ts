import { MedusaError } from "@medusajs/framework/utils"
import { type GroupBuyProgress, type GroupBuyTarget, isTargetReached } from "./target"

export type GroupOutcome = "succeeded" | "failed"
export type GroupBuyGroupStatus = "open" | GroupOutcome

const HOUR = 60 * 60 * 1000

// spec 04 กฎข้อ 8: open → succeeded | failed ครั้งเดียว; สั่งผลเดิมซ้ำ = no-op (idempotent); สลับผลไม่ได้
export function resolveGroupOutcomeTransition(from: GroupBuyGroupStatus, to: GroupOutcome): "apply" | "noop" {
  if (from === to) {
    return "noop"
  }
  if (from !== "open") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Group buy group is already ${from}`)
  }
  return "apply"
}

export const payDeadlineAt = (now: Date, payWithinHours: number) =>
  new Date(now.getTime() + payWithinHours * HOUR)

// deadline job: กลุ่ม open ที่ ends_at <= now → ถึงเป้าหมาย ? succeeded : failed
export const expiredGroupOutcome = (target: GroupBuyTarget, progress: GroupBuyProgress): GroupOutcome =>
  isTargetReached(target, progress) ? "succeeded" : "failed"

// กฎข้อ 10: แคมเปญ active ที่ Medusa campaign ends_at ผ่านไปแล้ว → ended (AC-22)
export const isCampaignExpired = (endsAt: string | Date | null | undefined, now: Date) =>
  !!endsAt && new Date(endsAt).getTime() <= now.getTime()
