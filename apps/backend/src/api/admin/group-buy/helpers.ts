import { AuthenticatedMedusaRequest, refetchEntity } from "@medusajs/framework/http"

type CampaignRecord = Record<string, unknown> & { promotion?: { id: string } | null }

// spec 04 API: คืน template_promotion_id ให้ admin ไปแก้ส่วนลด/scope ในหน้า promotion ของ Medusa admin
export const withTemplateId = (campaign: CampaignRecord) => ({
  ...campaign,
  template_promotion_id: campaign.promotion?.id ?? null,
})

export const refetchGroupBuyCampaign = async (req: AuthenticatedMedusaRequest, id: string) =>
  withTemplateId(
    await refetchEntity({
      entity: "group_buy_campaign",
      idOrFilter: id,
      scope: req.scope,
      fields: req.queryConfig.fields,
      options: { throwIfKeyNotFound: true },
    })
  )

export const refetchGroupBuyGroup = (req: AuthenticatedMedusaRequest, id: string) =>
  refetchEntity({
    entity: "group_buy_group",
    idOrFilter: id,
    scope: req.scope,
    fields: req.queryConfig.fields,
    options: { throwIfKeyNotFound: true },
  })
