import { LayoutComposer, NoRecords, SectionRow } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { Spinner } from "@medusajs/icons"
import { Badge, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FetchError } from "@medusajs/js-sdk"
import { useState } from "react"
import { Link, LoaderFunctionArgs, UIMatch, useNavigate, useParams } from "react-router-dom"
import { Container } from "../../../components/common/container"
import { Header } from "../../../components/common/header"
import { GroupsSection } from "../../../components/group-buy/groups-section"
import { campaignActions } from "../../../lib/group-buy-campaign"
import { CAMPAIGN_STATUS_COLOR, groupBuyApi, groupBuyKeys } from "../../../lib/group-buy"
import { createSingleFlight } from "../../../lib/single-flight"

type Action = "activate" | "end" | "remove"

const PROMPTS: Record<Action, { title: string; description: string; confirmText: string }> = {
  activate: {
    title: "Activate campaign?",
    description: "Customers can join groups once the campaign is active.",
    confirmText: "Activate",
  },
  end: {
    title: "End campaign?",
    description: "No new groups or joins after the campaign ends. This cannot be undone.",
    confirmText: "End",
  },
  remove: {
    title: "Delete draft campaign?",
    description: "The campaign, its template promotion and its Medusa campaign are deleted.",
    confirmText: "Delete",
  },
}

// GB-6b (spec 04 Admin UI, AC-30): รายละเอียดแคมเปญ — เปลี่ยนสถานะ / ลบ draft / ตารางกลุ่ม
const GroupBuyCampaignPage = () => {
  const { id } = useParams() as { id: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const { getFullDate } = useDate()

  const { data, isLoading, error } = useQuery({
    queryKey: groupBuyKeys.campaign(id),
    queryFn: () => groupBuyApi.getCampaign(id),
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
        toast.success("Campaign deleted")
        navigate("/group-buying")
      } else {
        queryClient.setQueryData(groupBuyKeys.campaign(id), result)
        toast.success(action === "activate" ? "Campaign activated" : "Campaign ended")
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onAction = (action: Action) =>
    actionOnce(async () => {
      if (await prompt({ ...PROMPTS[action], cancelText: "Cancel" })) {
        await run.mutateAsync(action).catch(() => undefined)
      }
    })

  if (error) {
    const notFound = (error as FetchError).status === 404
    return (
      <Container data-testid={notFound ? "gb-campaign-not-found" : undefined}>
        <NoRecords
          title={notFound ? "Campaign not found" : "Could not load the campaign"}
          message={notFound ? "It may have been deleted." : error.message}
          action={{ to: "/group-buying", label: "Back to group-buy campaigns" }}
        />
      </Container>
    )
  }

  if (isLoading || !data) {
    return (
      <Container>
        <NoRecords icon={<Spinner className="text-ui-fg-subtle animate-spin" />} title="Loading..." message="" />
      </Container>
    )
  }

  const campaign = data.campaign
  const actions = campaignActions(campaign)
  const buttons: { action: Action; testId: string; label: string; danger?: boolean }[] = [
    { action: "activate", testId: "gb-campaign-activate", label: "Activate" },
    { action: "end", testId: "gb-campaign-end", label: "End campaign" },
    { action: "remove", testId: "gb-campaign-delete", label: "Delete", danger: true },
  ]
  const fullDate = (value: string | null | undefined) => (value ? getFullDate({ date: value, includeTime: true }) : "-")
  const fields: [string, string, string][] = [
    ["target", "Target", `${campaign.target_value} ${campaign.target_type}`],
    ["group_mode", "Group mode", campaign.group_mode],
    ["starts_at", "Starts (ICT)", fullDate(campaign.campaign?.starts_at)],
    ["ends_at", "Ends (ICT)", fullDate(campaign.campaign?.ends_at)],
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
                          {campaign.status}
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
                    title="Template promotion"
                    value={
                      <Link to={`/promotions/${campaign.template_promotion_id}`}>
                        <Text size="small" leading="compact" className="text-ui-fg-interactive">
                          {campaign.promotion?.code ?? "Open"}
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
  breadcrumb: ({ loaderData }: UIMatch<CampaignLoaderData>) => loaderData?.campaign.name ?? "Campaign",
}

export default GroupBuyCampaignPage
