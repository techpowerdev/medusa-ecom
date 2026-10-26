import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService from "../../../modules/evoucher/service"

// mark ก่อนส่งอีเมล: ถ้าอีเมลล้ม code ยังอยู่กับ order สถานะ delivered → admin ส่งซ้ำได้ (EV-5b) ไม่ถูกขายซ้ำ
export const markEvoucherCodesDeliveredStep = createStep(
  "mark-evoucher-codes-delivered",
  async (input: { code_ids: string[]; email?: string | null }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const delivered_at = new Date()
    await service.updateEvoucherCodes(
      input.code_ids.map((id) => ({
        id,
        status: "delivered" as const,
        delivered_at,
        delivered_to_email: input.email ?? null,
      }))
    )
    return new StepResponse(undefined, input.code_ids)
  },
  async (codeIds, { container }) => {
    if (!codeIds?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    // เฉพาะแถวที่ยัง delivered: ไม่ทับ code ที่ compensation ของ claim คืนเป็น available ไปแล้ว
    await service.updateEvoucherCodes({
      selector: { id: codeIds, status: "delivered" },
      data: { status: "allocated", delivered_at: null, delivered_to_email: null },
    })
  }
)
