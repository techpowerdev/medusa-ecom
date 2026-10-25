import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { FLASH_SALE_MODULE } from "../../modules/flash_sale"
import type FlashSaleModuleService from "../../modules/flash_sale/service"

export type ReleaseFlashSaleReservationsStepInput = { cart_id: string }

// FS-2: คืนสิทธิ์ flash ตาม reservation ของ cart (idempotent ด้วย released_at)
// compensation: ยกเลิก release เฉพาะแถวที่ step นี้ release เอง แล้วจอง usage + units_sold กลับ
export const releaseFlashSaleReservationsStep = createStep(
  "release-flash-sale-reservations",
  async ({ cart_id }: ReleaseFlashSaleReservationsStepInput, { container }) => {
    const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    const released = await flashSale.releaseReservationsOfCart(cart_id)

    return new StepResponse(
      released,
      released.map((r) => r.id)
    )
  },
  async (releasedIds, { container }) => {
    if (!releasedIds?.length) {
      return
    }
    const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    await flashSale.restoreReleasedReservations(releasedIds)
  }
)
