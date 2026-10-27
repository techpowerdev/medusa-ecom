import type { Payout } from "./affiliate"

// AF-6 (AC-26): payout `paid` ยกเลิกไม่ได้ (backend ตอบ 400) จึงไม่แสดงปุ่ม
export const canCancelPayout = (payout: Pick<Payout, "status">) => payout.status === "draft"

/** กันกดซ้ำ: ระหว่างที่ fn ยังไม่จบ (รวมช่วงกล่องยืนยันเปิดอยู่) การเรียกซ้ำถูกเพิกเฉย */
export const singleFlight = <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) => {
  let running = false
  return async (...args: A) => {
    if (running) {
      return
    }
    running = true
    try {
      await fn(...args)
    } finally {
      running = false
    }
  }
}
