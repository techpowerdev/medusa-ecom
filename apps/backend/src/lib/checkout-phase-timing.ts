import type { Logger } from "@medusajs/framework/types"

/** OPS-20a (spec 07 AC-31): prefix ของบรรทัด log ช่วงเวลา checkout — `tools/load/checkout-timing.js` อ่านบรรทัดนี้ */
export const CHECKOUT_PHASE_MARKER = "checkout_phase_timing"

export type CheckoutPhaseEntry =
  | { phase: "route"; cart_id: string; entered_at: number; finished_at: number; status: number }
  | { phase: "hook"; cart_id: string; started_at: number; ended_at: number; outcome: string }

/** log ระดับ debug ของ logger เดิม (JSON logger ของ OPS-3) — เฉพาะเมื่อเปิด LOG_LEVEL=debug (load run) */
export function logCheckoutPhase(logger: Pick<Logger, "shouldLog" | "debug">, entry: CheckoutPhaseEntry): void {
  if (logger.shouldLog("debug")) {
    logger.debug(`${CHECKOUT_PHASE_MARKER} ${JSON.stringify(entry)}`)
  }
}
