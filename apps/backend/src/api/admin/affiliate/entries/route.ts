import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntities } from "@medusajs/framework/http"

// Ledger is read-only through the API (rule 5)
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data: entries, metadata } = await refetchEntities({
    entity: "affiliate_commission_entry",
    idOrFilter: req.filterableFields,
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({ entries, count: metadata.count, limit: metadata.take, offset: metadata.skip })
}
