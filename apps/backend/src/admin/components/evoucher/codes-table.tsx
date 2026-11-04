import { ActionMenu, DataTable } from "@medusajs/dashboard/components"
import { useDate, useQueryParams } from "@medusajs/dashboard/hooks"
import { EllipsisHorizontal, Eye } from "@medusajs/icons"
import {
  Badge,
  Copy,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  Drawer,
  IconButton,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CODE_STATUSES,
  evoucherApi,
  evoucherKeys,
  MaskedCode,
  RevealedCode,
  STATUS_COLOR,
} from "../../lib/evoucher"
import { codesListQuery } from "../../lib/evoucher-query"
import { createSingleFlight } from "../../lib/single-flight"
import { Container } from "../common/container"

const columnHelper = createDataTableColumnHelper<MaskedCode>()
const filterHelper = createDataTableFilterHelper<MaskedCode>()
const PAGE_SIZE = 50
const PREFIX = "codes"

// spec 08 AC-7: กรองสถานะด้วย filter ของ DataTable (radio = ค่าเดียว ตรงกับ `status` ของ API)
const filters = [
  filterHelper.accessor("status", {
    type: "radio",
    label: "Status",
    options: CODE_STATUSES.map((status) => ({ label: status, value: status })),
  }),
]

const OFFSET_KEY = `${PREFIX}_offset`

// เปลี่ยน filter แล้วต้องกลับหน้าแรก: DataTable ของ dashboard 2.22.1 เรียก reset หน้า (ลบ `codes_offset`) แล้วตามด้วยตั้ง filter
// ผ่าน setSearchParams สองครั้งใน tick เดียว — บน react-router 7 ครั้งหลังเขียนทับครั้งแรก offset จึงค้าง (กรองจากหน้า 2 แล้วได้ตารางว่าง)
// คืน true ตั้งแต่ status เปลี่ยนจนกว่า URL ไม่มี offset แล้วจริง เพื่อให้ทุก request ระหว่างนั้นใช้ offset 0 (ไม่ยิง request ของหน้าเก่า)
// — หน้า pool มี loader: การลบ offset ทำให้ router revalidate loader ก่อนอัปเดต URL จึงจำ status ใหม่ได้เมื่อ offset หายไปแล้วเท่านั้น
const useResetOffsetOnStatusChange = (status?: string, offset?: string) => {
  const [, setSearchParams] = useSearchParams()
  const [seen, setSeen] = useState(status)
  const changed = status !== seen

  useEffect(() => {
    if (!changed) {
      return
    }
    if (!offset) {
      setSeen(status)
      return
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(OFFSET_KEY)
        return next
      },
      { replace: true }
    )
  }, [changed, offset, status, setSearchParams])

  return changed
}

// รายการ code แบบ masked (AC-8); ค่าจริงดูได้ทีละ code ผ่าน reveal ซึ่ง backend เขียน audit ทุกครั้ง
// ADM-4: DataTable ของ dashboard (หน้า/filter อยู่ใน URL `codes_offset`, `codes_status`), Reveal ต่อแถวใน ActionMenu
export const CodesTable = ({ poolId }: { poolId: string }) => {
  const prompt = usePrompt()
  const { getFullDate } = useDate()
  const [revealOnce] = useState(createSingleFlight)
  const [revealed, setRevealed] = useState<RevealedCode | null>(null)
  const params = useQueryParams(["offset", "status"], PREFIX)
  const statusChanged = useResetOffsetOnStatusChange(params.status, params.offset)
  const query = codesListQuery(statusChanged ? { status: params.status } : params, PAGE_SIZE)

  const { data, isLoading } = useQuery({
    queryKey: [...evoucherKeys.codes(poolId), query],
    queryFn: () => evoucherApi.listCodes(poolId, query),
    placeholderData: keepPreviousData,
  })

  // useMutation (ไม่ใช่ useQuery) เพื่อไม่ให้ค่าจริงค้างใน query cache
  const reveal = useMutation({
    mutationFn: (id: string) => evoucherApi.revealCode(id),
    onSuccess: (res) => setRevealed(res.code),
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutateAsync: revealCode, isPending: revealing } = reveal
  const columns = useMemo(() => {
    // กฎ 4: guard ครอบทั้ง prompt + request — กด Reveal ซ้ำระหว่างรอเปิด prompt/request ใหม่ไม่ได้ (reveal เขียน audit ทุกครั้ง)
    const onReveal = (id: string) =>
      revealOnce(async () => {
        const ok = await prompt({
          title: "Reveal code?",
          description: "The real code and PIN will be shown. This action is recorded in the audit log.",
          confirmText: "Reveal",
          cancelText: "Cancel",
          variant: "confirmation",
        })
        if (ok) {
          await revealCode(id).catch(() => undefined)
        }
      })

    return [
      columnHelper.accessor("code", {
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
      }),
      columnHelper.accessor("has_pin", {
        header: "PIN",
        cell: ({ getValue }) => (getValue() ? "****" : "-"),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={STATUS_COLOR[getValue()]}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("expires_at", {
        header: "Expires",
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? getFullDate({ date: value }) : "-"
        },
      }),
      columnHelper.accessor("order_id", {
        header: "Order",
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Reveal",
                    icon: <Eye />,
                    disabled: revealing,
                    onClick: () => onReveal(row.original.id),
                  },
                ],
              },
            ]}
          >
            <IconButton size="small" variant="transparent" data-testid="evoucher-code-row-actions">
              <EllipsisHorizontal />
            </IconButton>
          </ActionMenu>
        ),
      }),
    ]
  }, [prompt, revealOnce, revealCode, revealing, getFullDate])

  return (
    <Container data-testid="evoucher-codes">
      <DataTable
        data={data?.codes ?? []}
        columns={columns}
        filters={filters}
        getRowId={(code) => code.id}
        rowCount={data?.count ?? 0}
        isLoading={isLoading}
        heading="Codes"
        headingLevel="h2"
        prefix={PREFIX}
        pageSize={PAGE_SIZE}
        enableSearch={false}
        emptyState={{
          empty: { heading: "No codes", description: "Import a CSV to add codes." },
          filtered: { heading: "No codes", description: "No codes match the selected status." },
        }}
      />

      <Drawer open={!!revealed} onOpenChange={(open) => !open && setRevealed(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Revealed code</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-4">
            {revealed && (
              <>
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    Code
                  </Text>
                  <div className="flex items-center gap-x-2">
                    <Text className="font-mono" data-testid="evoucher-revealed-code">
                      {revealed.code}
                    </Text>
                    <Copy content={revealed.code} />
                  </div>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    PIN
                  </Text>
                  <Text className="font-mono">{revealed.pin ?? "-"}</Text>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  Expires {revealed.expires_at ? getFullDate({ date: revealed.expires_at }) : "-"} · This reveal was
                  recorded in the audit log.
                </Text>
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
