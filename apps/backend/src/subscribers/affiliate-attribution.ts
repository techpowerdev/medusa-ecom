import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { attributeAffiliateOrderWorkflow } from "../workflows/affiliate/attribute-order"

// AF-3 (spec 05): order.placed → attribution จาก cart metadata.affiliate_token + commission entry
export default async function affiliateAttributionHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await attributeAffiliateOrderWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
