import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  type ConvertedMembershipResult,
  markGroupBuyMembershipPaidOnConvertWorkflow,
} from "../workflows/group-buy/membership-payment"

const errorMessage = (error: unknown) => (error as { message?: string } | null)?.message ?? String(error)

// spec 04 GB-10 (กฎข้อ 26): order.placed จาก convertDraftOrderWorkflow (ops แปลง draft order ของกลุ่มเองหลังเงินเข้า)
// → membership `paid` — ไม่ส่งอีเมลเพิ่ม (order-placed ส่งแล้ว) ไม่แปลง/ไม่ refund; order ที่ไม่ใช่ group buy ข้าม
export default async function groupBuyOrderPlacedHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: data.id },
  })
  const membershipId = orders[0]?.metadata?.group_buy_membership_id
  if (typeof membershipId !== "string") {
    return
  }
  const { result, errors } = (await markGroupBuyMembershipPaidOnConvertWorkflow(container).run({
    input: { membership_id: membershipId, order_id: data.id },
    throwOnError: false,
  })) as { result: ConvertedMembershipResult; errors: { error: unknown }[] }
  if (errors.length) {
    logger.error(
      `group-buy-order-placed: membership_id=${membershipId} order_id=${data.id} failed: ` +
        errors.map((e) => errorMessage(e.error)).join("; ")
    )
  } else if (result.action === "noop") {
    logger.info(
      `group-buy-order-placed: noop membership_id=${membershipId} order_id=${data.id} membership_status=${result.membership_status}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
