import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { importEvoucherCodesWorkflow } from "../../../../../../workflows/evoucher/import-evoucher-codes"

// multipart/form-data, field `file` = CSV `code,pin?,expires_at?` (multer ใน middlewares.ts)
export async function POST(
  req: AuthenticatedMedusaRequest & { file?: Express.Multer.File },
  res: MedusaResponse
) {
  if (!req.file) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No CSV file was uploaded (field `file`)")
  }
  const { result } = await importEvoucherCodesWorkflow(req.scope).run({
    input: {
      pool_id: req.params.id,
      file_content: req.file.buffer.toString("utf-8"),
    },
  })
  res.json(result)
}
