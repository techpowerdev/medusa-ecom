import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService, { ClaimCodesForOrderResult } from "../../../modules/evoucher/service"
import { expiryCutoff } from "../../../modules/evoucher/utils/expiry"
import { EvoucherLine, EvoucherOrder } from "./evoucher-order"

// claim แบบ atomic + idempotent (service.claimCodesForOrder); compensation ปล่อย code ที่ claim รอบนี้กลับเป็น available
// (compensation เกิดได้เฉพาะก่อนส่งอีเมลลูกค้า — ขั้นส่งอีเมลไม่ throw จึงไม่มีการคืน code ที่ลูกค้าอาจได้รับแล้ว)
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
      // รอบก่อน claim แล้วแต่ไม่ถึง delivered (process ตายกลางทาง) — ไม่ claim ซ้ำ ให้ admin ตรวจ/ส่งมอบเอง
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `evoucher: order ${input.order.id} has codes stuck in "allocated" for line items ` +
            `${result.stuck.join(", ")} — check the fulfillment and deliver manually`
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
