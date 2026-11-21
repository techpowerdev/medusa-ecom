// hotfix PAY-9 (spec 06 AC-22c, ADR-025): Medusa 2.22.1 คืนเงินใน compensation ของ completeCartWorkflow ที่ webhook สั่ง (async)
// ลำดับ (ยืนยันใน backend integration-tests/http/complete-after-payment-log.spec.ts):
// 1. refundPayment_ บันทึก refund ก่อนเรียก Stripe → "Stripe/Medusa มี refund" เป็นจริงขณะที่ session เดิมยัง authorized
// 2. recreate session ด้วย data เดิม 2 รอบ (createPaymentSessionStep + compensation ของ deletePaymentSessionsStep)
//    แต่ละรอบมีแถว pending ที่อ้าง PI เดิมจน Stripe ปฏิเสธ — ระหว่างรอบ sessions ว่างได้ชั่วครู่
// → refund หรือ "ไม่มี session ที่อ้าง PI เดิม" ไม่ใช่สัญญาณว่าจบ (isResettableCollection ของ backend ก็เป็นจริงตั้งแต่ข้อ 1)
// สัญญาณที่จบจริง: completeCartWorkflow (store: true) บันทึก execution เป็นสถานะจบหลัง compensation ทั้งหมด

export type WorkflowExecution = {
  state: string
  context?: { data?: { payload?: { id?: string } } } | null
}

const FINISHED_STATES = ["done", "reverted", "failed"]

/** มี execution ของ complete-cart สำหรับ cart นี้ และทุกตัวอยู่ในสถานะจบ (รวม compensation) */
export function cartCompletionSettled(executions: WorkflowExecution[], cartId: string): boolean {
  const mine = executions.filter((e) => e.context?.data?.payload?.id === cartId)
  return mine.length > 0 && mine.every((e) => FINISHED_STATES.includes(e.state))
}
