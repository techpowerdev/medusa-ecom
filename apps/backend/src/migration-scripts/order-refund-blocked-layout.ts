import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ORDER_DETAILS_LAYOUT_ZONE, withRefundBlockedWidgetFirst } from "../lib/order-refund-blocked-layout"

// PAY-10 (qa #471 D-2): ให้คำเตือน refund ถูกกันขึ้นบนสุดของหน้า order ใน system default layout ของ zone (เก็บ widget อื่นที่ตั้งไว้)
export default async function orderRefundBlockedLayout({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const settings = container.resolve(Modules.SETTINGS)

  const current = await settings.getSystemDefaultLayoutConfiguration(ORDER_DETAILS_LAYOUT_ZONE)
  const widgets = withRefundBlockedWidgetFirst(current?.configuration?.widgets)
  if (!widgets) {
    return
  }
  await settings.setSystemDefaultLayoutConfiguration(ORDER_DETAILS_LAYOUT_ZONE, { widgets })
  logger.info(`Placed the refund-blocked widget first in the default "${ORDER_DETAILS_LAYOUT_ZONE}" layout`)
}
