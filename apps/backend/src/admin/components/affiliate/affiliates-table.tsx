import { ActionMenu } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { ArrowPath, CheckCircle, EllipsisHorizontal, PencilSquare, XCircle } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, IconButton, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminAffiliate, affiliateKeys, updateAffiliate } from "../../lib/affiliate"
import { affiliateAction } from "../../lib/affiliate-account"
import { createSingleFlight } from "../../lib/single-flight"
import { useRemountMenu } from "../common/use-remount-menu"
import { AffiliateListTable, useAffiliateList } from "./list-table"
import { PayoutInfoDrawer } from "./payout-info-drawer"

const columnHelper = createDataTableColumnHelper<AdminAffiliate>()

const STATUS_COLOR = { pending: "orange", active: "green", suspended: "red" } as const
const STATUS_ICON = { pending: <CheckCircle />, active: <XCircle />, suspended: <ArrowPath /> } as const

type Update = { id: string; body: Parameters<typeof updateAffiliate>[1] }

// แถว (สถานะ) และ drawer ข้อมูลรับเงินใช้ mutation แบบเดียวกัน
const useUpdateAffiliate = () => {
  const { t } = useTranslation("ecom-affiliate")
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("affiliates") })
  return useMutation({
    mutationFn: ({ id, body }: Update) => updateAffiliate(id, body),
    onSuccess: () => {
      toast.success(t("affiliates.updated"))
      return refetch()
    },
    // ล้ม (เช่น สถานะถูกเปลี่ยนไปแล้ว 409 AFFILIATE_STATUS_CHANGED) → toast ข้อความจาก API แล้วโหลดรายการใหม่ (กฎ 37)
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })
}

/**
 * ADM-8b (spec 08 AC-13, กฎ 4, 10): ปุ่มต่อแถวใน ActionMenu — ถือ prompt/mutation สถานะของแถวเอง (แบบ `*Actions` ของ dashboard)
 * drawer ข้อมูลรับเงินอยู่นอกตาราง (render ใน cell แล้ว Escape ครั้งแรกไม่ปิด)
 */
const AffiliateActions = ({
  affiliate,
  onEditPayoutInfo,
}: {
  affiliate: AdminAffiliate
  onEditPayoutInfo: (a: AdminAffiliate) => void
}) => {
  const { t } = useTranslation("ecom-affiliate")
  const prompt = usePrompt()
  // instance คงที่ตลอดอายุ component (กฎ 4) — กด menuitem ซ้ำหรือกดระหว่าง prompt เปิด = ไม่ยิงซ้ำ
  const [actOnce] = useState(createSingleFlight)
  // เปิด Drawer จาก menuitem: remount เมนู (กฎ 27b) + focus ปุ่ม … ตัวใหม่ให้ Drawer คืน focus เมื่อปิด (spec 08 กฎ 51)
  const { menuKey, remountMenu, trigger } = useRemountMenu()
  const update = useUpdateAffiliate()

  const action = affiliateAction(affiliate.status)
  const changeStatus = () =>
    actOnce(async () => {
      if (action.confirm) {
        const ok = await prompt({
          title: t("affiliates.suspendPrompt.title", { name: affiliate.name }),
          description: t("affiliates.suspendPrompt.description"),
          confirmText: t("affiliates.suspendPrompt.confirm"),
          cancelText: t("actions.cancel", { ns: "translation" }),
        })
        if (!ok) {
          return
        }
      }
      // AF-15 (กฎ 39b): ส่งสถานะที่แถวแสดงเสมอ — แท็บอื่นเปลี่ยนไปแล้ว → 409 → toast + refetch (onError)
      await update
        .mutateAsync({ id: affiliate.id, body: { status: action.status, expected_status: affiliate.status } })
        .catch(() => undefined)
    })

  return (
    <ActionMenu
      key={menuKey}
      groups={[
        {
          actions: [
            {
              label: action.label,
              icon: STATUS_ICON[affiliate.status],
              disabled: update.isPending,
              onClick: changeStatus,
            },
          ],
        },
        {
          actions: [
            {
              label: t("affiliates.actions.payoutInfo"),
              icon: <PencilSquare />,
              onClick: () => {
                remountMenu()
                onEditPayoutInfo(affiliate)
              },
            },
          ],
        },
      ]}
    >
      <IconButton ref={trigger} size="small" variant="transparent" data-testid="affiliate-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// AF-12b (spec 05 กฎ 37b, AC-43): แท็บ Affiliates — approve/suspend/reactivate + ข้อมูลรับเงิน
export const AffiliatesTable = () => {
  const { t } = useTranslation("ecom-affiliate")
  const { getFullDate } = useDate()
  const list = useAffiliateList<AdminAffiliate>("affiliates", "affiliates", { searchable: true })
  const [editing, setEditing] = useState<AdminAffiliate | null>(null)
  const update = useUpdateAffiliate()

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount แถวใหม่และเมนูที่เปิดอยู่ปิดเองตอน refetch
  const actionsColumn = useMemo(
    () =>
      columnHelper.display({
        id: "actions",
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip ที่เปิดเมื่อ focus กลับมาที่ trigger กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
        cell: ({ row }) => <AffiliateActions affiliate={row.original} onEditPayoutInfo={setEditing} />,
      }),
    [],
  )

  const columns = useMemo(
    () => [
      // spec 08 กฎ 39 (ADM-35): เนื้อหา 250px (แบบ ProductCell ของ dashboard) — DataTable เป็น auto layout + nowrap คอลัมน์จึงขยายตามข้อความ
      // จนปุ่ม … หลุดจอ; size/maxSize เป็น width/max-width ของ td (border-box) จึงบวก padding: คอลัมน์แรก pl-6+pr-6 = 298, คอลัมน์อื่น pr-6 = 274
      // ข้อความที่ถูกตัดยังมี tooltip ของ TruncatedCell
      columnHelper.accessor("name", { header: t("affiliates.columns.name"), size: 298, maxSize: 298 }),
      columnHelper.accessor("email", { header: t("affiliates.columns.email"), size: 274, maxSize: 274 }),
      columnHelper.accessor("code", { header: t("affiliates.columns.code") }),
      columnHelper.accessor("status", {
        header: t("affiliates.columns.status"),
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={STATUS_COLOR[getValue()]} data-testid="affiliate-status">
            {t(`affiliates.status.${getValue()}`, { defaultValue: getValue() })}
          </Badge>
        ),
      }),
      actionsColumn,
      // spec 08 กฎ 41c (ADM-37, Q12 = ก): คอลัมน์สุดท้ายเป็น auto (ไม่มี width) รับความกว้างส่วนเกินที่จอกว้าง — ไม่งั้นทุก td ได้ width 150
      // (ค่าเริ่มต้นของ tanstack) ผลรวมน้อยกว่าตาราง w-full แล้ว Chrome แจกส่วนเกินตามสัดส่วนโดยไม่สน maxSize ของคอลัมน์ข้อความ
      columnHelper.accessor("created_at", {
        header: t("affiliates.columns.created_at"),
        size: undefined,
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
    ],
    [actionsColumn, getFullDate, t],
  )

  return (
    <>
      {/* spec 08 กฎ 39d: e2e หาแถวภายในตารางนี้ (ไม่ใช้ tbody tr ทั้งหน้า) */}
      <div data-testid="affiliate-affiliates-table">
        <AffiliateListTable
          {...list}
          columns={columns}
          heading={t("affiliates.heading")}
          subHeading={t("affiliates.subHeading")}
          empty={t("affiliates.empty")}
        />
      </div>
      {editing && (
        <PayoutInfoDrawer
          key={editing.id}
          affiliate={editing}
          onClose={() => setEditing(null)}
          save={(payout_info) => update.mutateAsync({ id: editing.id, body: { payout_info } })}
        />
      )}
    </>
  )
}
