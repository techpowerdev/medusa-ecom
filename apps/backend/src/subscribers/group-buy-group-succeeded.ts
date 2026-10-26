import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { GROUP_BUY_GROUP_SUCCEEDED } from "../workflows/group-buy/join-group"
import { succeedGroupWorkflow } from "../workflows/group-buy/group-outcome"

// spec 04: กลุ่มถึงเป้าหมายตอน join → succeed ทันที (AC-1) — workflow idempotent จึงรับ event ซ้ำได้
export default async function groupBuyGroupSucceededHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await succeedGroupWorkflow(container).run({ input: { group_id: data.id } })
}

export const config: SubscriberConfig = {
  event: GROUP_BUY_GROUP_SUCCEEDED,
}
