import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { GroupsSection } from "../../../components/group-buy/groups-section"
import { campaignActions } from "../../../lib/group-buy-campaign"
import { CAMPAIGN_STATUS_COLOR, formatDateTime, groupBuyApi, groupBuyKeys } from "../../../lib/group-buy"

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

  const { data, isLoading } = useQuery({
    queryKey: groupBuyKeys.campaign(id),
    queryFn: () => groupBuyApi.getCampaign(id),
  })

  // กันกดซ้ำ (กฎข้อ 17): ref ตั้งทันทีก่อน await — สองคลิกใน task เดียวไม่ยิงซ้ำ
  const inFlight = useRef(false)
  const run = useMutation({
    mutationFn: (action: Action) =>
      action === "remove"
        ? groupBuyApi.deleteCampaign(id)
        : groupBuyApi.setStatus(id, action === "activate" ? "active" : "ended"),
    onSuccess: (result, action) => {
      // key รายการ = ["group-buy","campaigns",limit,offset]; key แคมเปญนี้ = [...,id] (และ groups = [...,id,"groups"])
      // predicate ข้ามทุก key ที่ตำแหน่ง [2] เป็น id นี้ → refetch เฉพาะรายการ; แคมเปญนี้ใช้ค่าจาก response
      // (ถ้า refetch หลังลบจะได้ 404)
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.campaigns, predicate: (q) => q.queryKey[2] !== id })
      if (action === "remove") {
        queryClient.removeQueries({ queryKey: groupBuyKeys.campaign(id) })
        toast.success("Campaign deleted")
        navigate("/group-buying")
      } else {
        queryClient.setQueryData(groupBuyKeys.campaign(id), result)
        toast.success(action === "activate" ? "Campaign activated" : "Campaign ended")
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      inFlight.current = false
    },
  })

  const onAction = async (action: Action) => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    if (!(await prompt({ ...PROMPTS[action], cancelText: "Cancel" }))) {
      inFlight.current = false
      return
    }
    run.mutate(action)
  }

  if (isLoading || !data) {
    return (
      <Container className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Loading...
        </Text>
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
  const fields: [string, string][] = [
    ["Target", `${campaign.target_value} ${campaign.target_type}`],
    ["Group mode", campaign.group_mode],
    ["Starts (ICT)", formatDateTime(campaign.campaign?.starts_at)],
    ["Ends (ICT)", formatDateTime(campaign.campaign?.ends_at)],
  ]

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-x-4 px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading level="h1">{campaign.name}</Heading>
            <Badge size="2xsmall" color={CAMPAIGN_STATUS_COLOR[campaign.status]} data-testid="gb-campaign-status">
              {campaign.status}
            </Badge>
          </div>
          <div className="flex items-center gap-x-2">
            {buttons
              .filter((b) => actions[b.action])
              .map((b) => (
                <Button
                  key={b.action}
                  size="small"
                  variant={b.danger ? "danger" : "secondary"}
                  data-testid={b.testId}
                  onClick={() => onAction(b.action)}
                  disabled={run.isPending}
                >
                  {b.label}
                </Button>
              ))}
          </div>
        </div>
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-2 px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              {label}
            </Text>
            <Text size="small" leading="compact">
              {value}
            </Text>
          </div>
        ))}
        {campaign.template_promotion_id && (
          <div className="grid grid-cols-2 px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              Template promotion
            </Text>
            <Link to={`/promotions/${campaign.template_promotion_id}`}>
              <Text size="small" leading="compact" className="text-ui-fg-interactive">
                {campaign.promotion?.code ?? "Open"}
              </Text>
            </Link>
          </div>
        )}
      </Container>
      <GroupsSection campaign={campaign} />
    </div>
  )
}

export default GroupBuyCampaignPage
