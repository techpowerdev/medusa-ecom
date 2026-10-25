import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { getActiveFlashSalesWorkflow } from "../../../../workflows/flash-sale/get-active-flash-sales"
import type { StoreGetActiveFlashSalesParams } from "../validators"

// FS-4 (spec 03 "API", AC-4): flash campaign ที่กำลังทำงาน + flash_price ต่อ variant
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetActiveFlashSalesParams>,
  res: MedusaResponse
) {
  const { region_id, variant_ids } = req.validatedQuery as StoreGetActiveFlashSalesParams
  const { result } = await getActiveFlashSalesWorkflow(req.scope).run({
    input: {
      region_id,
      variant_ids,
      sales_channel_ids: req.publishable_key_context?.sales_channel_ids ?? [],
    },
  })
  res.json(result)
}
