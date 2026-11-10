import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import EvoucherModuleService from "../../../modules/evoucher/service"

// step แรกของทุก workflow ที่เข้ารหัส/ถอดรหัส: ล้มก่อนแตะข้อมูลถ้า key ไม่ถูกต้อง
export const assertEvoucherKeyStep = createStep(
  "assert-evoucher-key",
  async (_input: void, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.assertEncryptionKey()
    return new StepResponse(undefined)
  }
)
