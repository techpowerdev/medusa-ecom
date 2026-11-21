import type { ExecArgs, IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EVOUCHER_BACKORDERED_METADATA_KEY } from "../workflows/evoucher/steps/evoucher-order"
import { writeEvoucherBackorderedFlag } from "../workflows/evoucher/steps/update-evoucher-backordered-flags"

// EV-25 (spec 02 กฎข้อ 41): order ก่อน EV-22 มีธง backordered แค่ใน order_line_item.metadata แต่ Admin API คืน
// `items[].metadata` จาก order_item ก่อน → badge ไม่ขึ้น script นี้เขียนธงลง order_item ด้วย helper เดียวกับ EV-22
// ใช้: `npx medusa exec ./src/scripts/backfill-evoucher-backordered-flags.ts` (dry-run) แล้วเพิ่มคำ `apply` ท้ายคำสั่งเพื่อเขียนจริง
// (`medusa exec` ของ @medusajs/cli เป็น yargs `.strict()` — `--apply` ถูกปฏิเสธ `Unknown argument` ก่อนโหลด script; รับ `--apply` ไว้ด้วยเมื่อเรียก function ตรง)

const BATCH = 100

type BackfillLine = { order_id: string; display_id?: number | null; line_item_id: string; metadata: Record<string, unknown> }

// shape ภายในของ formatOrder ใน @medusajs/order (`dist/utils/transform-order.js:40-41` ของ 2.22.1: `line_item_metadata` = order_line_item,
// `detail` = order_item) — ไม่อยู่ใน OrderDTO จึง cast; ต้องตรวจใหม่ทุกครั้งที่ bump @medusajs/*
type ListedItem = {
  id: string
  line_item_metadata?: Record<string, unknown> | null
  detail?: { metadata?: Record<string, unknown> | null } | null
}

/** line ที่ธงอยู่ใน order_line_item แต่ไม่อยู่ใน order_item (formatOrder ของ order module แยก `line_item_metadata` กับ `detail`) */
async function findLines(orderModule: IOrderModuleService): Promise<BackfillLine[]> {
  const lines: BackfillLine[] = []
  for (let skip = 0; ; skip += BATCH) {
    const orders = await orderModule.listOrders({}, { select: ["id", "display_id"], relations: ["items"], take: BATCH, skip, order: { id: "ASC" } })
    for (const order of orders) {
      for (const item of (order.items ?? []) as unknown as ListedItem[]) {
        const lineMetadata = item.line_item_metadata ?? {}
        if (
          lineMetadata[EVOUCHER_BACKORDERED_METADATA_KEY] === true &&
          item.detail?.metadata?.[EVOUCHER_BACKORDERED_METADATA_KEY] !== true
        ) {
          lines.push({ order_id: order.id, display_id: order.display_id, line_item_id: item.id, metadata: lineMetadata })
        }
      }
    }
    if (orders.length < BATCH) {
      return lines
    }
  }
}

/** dry-run (`apply: false`) คืนรายการเท่านั้น; `apply: true` เขียนธงแล้วนับใหม่ — รันซ้ำได้ (ครั้งถัดไปได้ 0 แถว) */
export async function backfillEvoucherBackorderedFlags(
  container: MedusaContainer,
  { apply }: { apply: boolean }
): Promise<{ lines: Omit<BackfillLine, "metadata">[]; applied: number; remaining: number }> {
  const orderModule = container.resolve(Modules.ORDER)
  const found = await findLines(orderModule)
  const lines = found.map(({ metadata: _metadata, ...line }) => line)
  if (!apply) {
    return { lines, applied: 0, remaining: found.length }
  }
  for (const line of found) {
    await writeEvoucherBackorderedFlag(orderModule, line.line_item_id, line.metadata)
  }
  return { lines, applied: found.length, remaining: (await findLines(orderModule)).length }
}

export default async function backfillEvoucherBackorderedFlagsScript({ container, args }: ExecArgs) {
  const apply = (args ?? []).some((arg) => arg === "apply" || arg === "--apply")
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const result = await backfillEvoucherBackorderedFlags(container, { apply })
  for (const line of result.lines) {
    logger.info(`backfill-evoucher-backordered: order #${line.display_id ?? "-"} (${line.order_id}) line ${line.line_item_id}`)
  }
  logger.info(
    apply
      ? `backfill-evoucher-backordered: ก่อน ${result.lines.length} line, เขียนธง ${result.applied} line, หลัง ${result.remaining} line`
      : `backfill-evoucher-backordered: dry-run พบ ${result.lines.length} line (ยังไม่เขียน — รันซ้ำพร้อมคำ apply)`
  )
}
