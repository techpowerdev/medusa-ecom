import { LayoutComposer, NoRecords, SectionRow } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { Spinner } from "@medusajs/icons"
import { Badge, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FetchError } from "@medusajs/js-sdk"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, LoaderFunctionArgs, UIMatch, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { Container } from "../../../components/common/container"
import { Header } from "../../../components/common/header"
import { GroupsSection } from "../../../components/group-buy/groups-section"
import { t as tNs } from "../../../i18n/t"
import { campaignActions } from "../../../lib/group-buy-campaign"
import { CAMPAIGN_STATUS_COLOR, groupBuyApi, groupBuyKeys } from "../../../lib/group-buy"
import { createSingleFlight } from "../../../lib/single-flight"

type Action = "activate" | "end" | "remove"

// GB-6b (spec 04 Admin UI, AC-30): รายละเอียดแคมเปญ — เปลี่ยนสถานะ / ลบ draft / ตารางกลุ่ม
const GroupBuyCampaignPage = () => {
  const { t } = useTranslation("ecom-group-buy")
  const { id } = useParams() as { id: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const { getFullDate } = useDate()

  // ADM-11 (spec 08 กฎ 14): ใช้ผลของ loader เป็นค่าเริ่ม → ไม่ GET แคมเปญซ้ำ; loader คืน null (404) → undefined ให้ query ยิงเอง
  const initialData = (useLoaderData() as CampaignLoaderData | undefined) ?? undefined
  const { data, isLoading, error } = useQuery({
    queryKey: groupBuyKeys.campaign(id),
    queryFn: () => groupBuyApi.getCampaign(id),
    initialData,
    // 404 (ไม่มี/ลบแล้ว) ไม่ retry — แสดงผลทันที (qa D-2)
    retry: (count, e) => (e as FetchError).status !== 404 && count < 2,
  })

  // กันกดซ้ำ (กฎข้อ 17 / spec 08 กฎ 4): guard ตั้งทันทีก่อน await — สองคลิกใน task เดียวไม่ยิงซ้ำ
  const [actionOnce] = useState(createSingleFlight)
  const run = useMutation({
    mutationFn: (action: Action) =>
      action === "remove"
        ? groupBuyApi.deleteCampaign(id)
        : groupBuyApi.setStatus(id, action === "activate" ? "active" : "ended"),
    onSuccess: (result, action) => {
      // key รายการ = ["group-buy","campaigns",limit,offset]; key แคมเปญนี้ = [...,id] (และ groups = [...,id,"groups"])
      // predicate ข้ามทุก key ที่ตำแหน่ง [2] เป็น id นี้ → refetch เฉพาะรายการ; แคมเปญนี้ใช้ค่าจาก response
      // (ถ้า refetch หลังลบจะได้ 404)
      // ไม่ removeQueries แคมเปญที่ลบ: ระหว่างที่หน้านี้ยัง mount observer จะ refetch ทันที → 404 (qa D-1)
      // cache ที่ค้างหมดอายุเองตาม gcTime; ถ้าเปิด id นี้อีกจะ refetch ได้ 404 แล้วแสดง not found
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.campaigns, predicate: (q) => q.queryKey[2] !== id })
      if (action === "remove") {
        toast.success(t("detail.toast.deleted"))
        navigate("/group-buying")
      } else {
        queryClient.setQueryData(groupBuyKeys.campaign(id), result)
        toast.success(action === "activate" ? t("detail.toast.activated") : t("detail.toast.ended"))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // spec 10 กฎ 4e (AI18N-2): ข้อความ prompt ย้ายจากค่าคงที่ระดับ module เข้า component เพื่อเรียก t ตอน render
  const prompts: Record<Action, { title: string; description: string; confirmText: string }> = {
    activate: {
      title: t("detail.prompts.activate.title"),
      description: t("detail.prompts.activate.description"),
      confirmText: t("detail.prompts.activate.confirm"),
    },
    end: {
      title: t("detail.prompts.end.title"),
      description: t("detail.prompts.end.description"),
      confirmText: t("detail.prompts.end.confirm"),
    },
    remove: {
      title: t("detail.prompts.remove.title"),
      description: t("detail.prompts.remove.description"),
      confirmText: t("actions.delete", { ns: "translation" }),
    },
  }

  const onAction = (action: Action) =>
    actionOnce(async () => {
      if (await prompt({ ...prompts[action], cancelText: t("actions.cancel", { ns: "translation" }) })) {
        await run.mutateAsync(action).catch(() => undefined)
      }
    })

  if (error) {
    const notFound = (error as FetchError).status === 404
    return (
      <Container data-testid={notFound ? "gb-campaign-not-found" : undefined}>
        <NoRecords
          title={notFound ? t("detail.notFound") : t("detail.loadError")}
          message={notFound ? t("detail.notFoundMessage") : error.message}
          action={{ to: "/group-buying", label: t("detail.back") }}
        />
      </Container>
    )
  }

  if (isLoading || !data) {
    return (
      <Container>
        <NoRecords icon={<Spinner className="text-ui-fg-subtle animate-spin" />} title={t("loading")} message="" />
      </Container>
    )
  }

  const campaign = data.campaign
  const actions = campaignActions(campaign)
  const buttons: { action: Action; testId: string; label: string; danger?: boolean }[] = [
    { action: "activate", testId: "gb-campaign-activate", label: t("detail.activate") },
    { action: "end", testId: "gb-campaign-end", label: t("detail.end") },
    { action: "remove", testId: "gb-campaign-delete", label: t("actions.delete", { ns: "translation" }), danger: true },
  ]
  const fullDate = (value: string | null | undefined) => (value ? getFullDate({ date: value, includeTime: true }) : "-")
  const fields: [string, string, string][] = [
    [
      "target",
      t("detail.fields.target"),
      t(`targetValue.${campaign.target_type}`, {
        value: campaign.target_value,
        defaultValue: `${campaign.target_value} ${campaign.target_type}`,
      }),
    ],
    ["group_mode", t("detail.fields.groupMode"), t(`groupMode.${campaign.group_mode}`, { defaultValue: campaign.group_mode })],
    ["starts_at", t("detail.fields.startsAt"), fullDate(campaign.campaign?.starts_at)],
    ["ends_at", t("detail.fields.endsAt"), fullDate(campaign.campaign?.ends_at)],
  ]

  return (
    <LayoutComposer
      widgetsZonePrefix="group_buy.details"
      preferredLayoutId="core:single-column"
      data={campaign}
      sections={{
        main: (
          <>
            <LayoutComposer.Entry id="GroupBuyCampaignGeneralSection">
              <Container>
                <Header
                  title={campaign.name}
                  actions={[
                    {
                      type: "custom",
                      children: (
                        <Badge size="2xsmall" color={CAMPAIGN_STATUS_COLOR[campaign.status]} data-testid="gb-campaign-status">
                          {t(`status.${campaign.status}`, { defaultValue: campaign.status })}
                        </Badge>
                      ),
                    },
                    ...buttons
                      .filter((b) => actions[b.action])
                      .map((b) => ({
                        type: "button" as const,
                        props: {
                          variant: b.danger ? ("danger" as const) : ("secondary" as const),
                          "data-testid": b.testId,
                          onClick: () => onAction(b.action),
                          disabled: run.isPending,
                          children: b.label,
                        },
                      })),
                  ]}
                />
                {/* SectionRow ไม่รับ data-testid — ห่อด้วย div ที่คง testid เดิมของ e2e (spec 08 กฎ 7) */}
                {fields.map(([key, label, value]) => (
                  <div key={key} data-testid={`gb-campaign-row-${key}`}>
                    <SectionRow title={label} value={value} />
                  </div>
                ))}
                {campaign.template_promotion_id && (
                  <SectionRow
                    title={t("detail.fields.templatePromotion")}
                    value={
                      <Link to={`/promotions/${campaign.template_promotion_id}`}>
                        <Text size="small" leading="compact" className="text-ui-fg-interactive">
                          {campaign.promotion?.code ?? t("list.openPromotion")}
                        </Text>
                      </Link>
                    }
                  />
                )}
              </Container>
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="GroupBuyGroupsSection">
              <GroupsSection campaign={campaign} />
            </LayoutComposer.Entry>
          </>
        ),
      }}
    />
  )
}

type CampaignLoaderData = Awaited<ReturnType<typeof groupBuyApi.getCampaign>> | null

// ADM-6 (spec 08 AC-9): breadcrumb แสดงชื่อแคมเปญ (loader โหลดตอนเข้า route แบบหน้า pool)
// โหลดไม่ได้ (เช่น 404) → null ไม่ throw ให้ component แสดง gb-campaign-not-found เหมือนเดิม (ไม่ตกไป error boundary)
export const loader = async ({ params }: LoaderFunctionArgs): Promise<CampaignLoaderData> =>
  groupBuyApi.getCampaign(params.id!).catch(() => null)

export const handle = {
  // spec 10 กฎ 4b, 9: ชื่อแคมเปญจาก loader คงเดิม; fallback แปลด้วย helper t (alias tNs — AI18N-N1) ตอนรัน
  breadcrumb: ({ loaderData }: UIMatch<CampaignLoaderData>) =>
    loaderData?.campaign.name ?? tNs("ecom-group-buy", "breadcrumb.campaign"),
}

export default GroupBuyCampaignPage
