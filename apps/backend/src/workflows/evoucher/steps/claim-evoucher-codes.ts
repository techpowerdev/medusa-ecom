import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService, { ClaimCodesForOrderResult } from "../../../modules/evoucher/service"
import { expiryCutoff } from "../../../modules/evoucher/utils/expiry"
import { EvoucherLine, EvoucherOrder } from "./evoucher-order"

// claim แบบ atomic + idempotent (service.claimCodesForOrder); compensation ปล่อย code ที่ claim รอบนี้กลับเป็น available
// (compensation เกิดได้เฉพาะก่อนส่งอีเมลลูกค้า — ขั้นส่งอีเมลเป็นขั้นสุดท้ายและไม่ throw จึงไม่คืน code ที่ลูกค้าอาจได้รับแล้ว)
export const claimEvoucherCodesStep = createStep(
  "claim-evoucher-codes",
  async (input: { order: EvoucherOrder; lines: EvoucherLine[] }, { container }) => {
    const empty: ClaimCodesForOrderResult = { allocated: [], backordered: [], skipped: [], stuck: [] }
    if (!input.lines.length) {
      return new StepResponse(empty, [] as string[])
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    // ล้มก่อน claim ถ้า key ผิด (ต้องใช้ key กับ ciphertext ในอีเมล)
    await service.assertEncryptionKey()
    const result = await service.claimCodesForOrder({
      order_id: input.order.id,
      customer_id: input.order.customer_id,
      items: input.lines,
      // กฎข้อ 2: ไม่เลือก code ที่หมดอายุภายใน 7 วัน
      expires_after: expiryCutoff(new Date()),
    })
    if (result.stuck.length) {
      // code `allocated` แต่ยังไม่ส่งมอบ (อีเมลล้ม หรือ process ตายกลางทาง) — ไม่ claim ซ้ำ (กฎข้อ 17) ให้ admin ใช้ resend
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `evoucher: order ${input.order.id} has codes allocated but not delivered for line items ` +
            `${result.stuck.join(", ")} — use resend (EV-5b) to deliver them`
        )
    }
    return new StepResponse(
      result,
      result.allocated.flatMap((a) => a.code_ids)
    )
  },
  async (codeIds, { container }) => {
    if (!codeIds?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherCodes(
      codeIds.map((id) => ({
        id,
        status: "available" as const,
        order_id: null,
        order_line_item_id: null,
        customer_id: null,
        allocated_at: null,
        delivered_at: null,
        delivered_to_email: null,
      }))
    )
  }
)
