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
import { keepPreviousData, useIsMutating, useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CODE_STATUSES,
  evoucherApi,
  evoucherKeys,
  MaskedCode,
  RevealedCode,
  STATUS_COLOR,
} from "../../lib/evoucher"
import { codesListQuery } from "../../lib/evoucher-query"
import { isUnauthorized } from "../../lib/fetch-error"
import { isPastLastPage } from "../../lib/page-offset"
import { createSingleFlight } from "../../lib/single-flight"
import { Container } from "../common/container"
import { usePageOffset } from "../common/use-page-offset"
import { PageOffsetGate } from "../common/page-offset-gate"

const columnHelper = createDataTableColumnHelper<MaskedCode>()
const filterHelper = createDataTableFilterHelper<MaskedCode>()
const PAGE_SIZE = 50
const PREFIX = "codes"
const REVEAL_KEY = ["evoucher", "code-reveal"]

/**
 * ADM-16 (spec 08 กฎ 20a): Reveal ต่อแถวใน ActionMenu — ถือ prompt/mutation ของแถวเอง (แบบ `ProgramActions`)
 * guard `revealOnce` มาจากตาราง (ตัวเดียวทั้งตาราง) และ Reveal disabled ทุกแถวระหว่าง reveal ใดๆ ยังไม่จบ (mutationKey เดียวกัน)
 */
const CodeActions = ({
  id,
  revealOnce,
  onRevealed,
}: {
  id: string
  revealOnce: ReturnType<typeof createSingleFlight>
  onRevealed: (code: RevealedCode) => void
}) => {
  const { t } = useTranslation("ecom-evoucher")
  const prompt = usePrompt()
  const revealing = useIsMutating({ mutationKey: REVEAL_KEY }) > 0
  // useMutation (ไม่ใช่ useQuery) เพื่อไม่ให้ค่าจริงค้างใน query cache
  const reveal = useMutation({
    mutationKey: REVEAL_KEY,
    mutationFn: () => evoucherApi.revealCode(id),
    onSuccess: (res) => onRevealed(res.code),
    onError: (e: Error) => toast.error(e.message),
  })

  // กฎ 4: guard ครอบทั้ง prompt + request — กด Reveal ซ้ำระหว่างรอเปิด prompt/request ใหม่ไม่ได้ (reveal เขียน audit ทุกครั้ง)
  const onReveal = () =>
    revealOnce(async () => {
      const ok = await prompt({
        title: t("codes.revealTitle"),
        description: t("codes.revealDescription"),
        confirmText: t("codes.reveal"),
        cancelText: t("actions.cancel", { ns: "translation" }),
        variant: "confirmation",
      })
      if (ok) {
        await reveal.mutateAsync().catch(() => undefined)
      }
    })

  return (
    <ActionMenu groups={[{ actions: [{ label: t("codes.reveal"), icon: <Eye />, disabled: revealing, onClick: onReveal }] }]}>
      <IconButton size="small" variant="transparent" data-testid="evoucher-code-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// รายการ code แบบ masked (AC-8); ค่าจริงดูได้ทีละ code ผ่าน reveal ซึ่ง backend เขียน audit ทุกครั้ง
// ADM-4: DataTable ของ dashboard (หน้า/filter อยู่ใน URL `codes_offset`, `codes_status`), Reveal ต่อแถวใน ActionMenu
export const CodesTable = ({ poolId }: { poolId: string }) => {
  const { t } = useTranslation("ecom-evoucher")
  const { getFullDate } = useDate()
  const [revealOnce] = useState(createSingleFlight)
  const [revealed, setRevealed] = useState<RevealedCode | null>(null)
  const { status } = useQueryParams(["status"], PREFIX)
  const [count, setCount] = useState<number>()
  // เปลี่ยน filter แล้วกลับหน้าแรก (resetOn — workaround upstream กฎ 17 อยู่ใน hook)
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count, resetOn: status })
  const query = codesListQuery(status, offset, PAGE_SIZE)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...evoucherKeys.codes(poolId), query],
    queryFn: () => evoucherApi.listCodes(poolId, query),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])

  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data
  // กฎ 20b/27a: offset เกินที่ usePageOffset กำลัง clamp → แสดง loading แทน empty state "Import a CSV" ที่ไม่จริง
  const pastLastPage = isPastLastPage(data?.count, data?.codes.length)

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount แถวใหม่และเมนูที่เปิดอยู่ปิดเองตอน refetch
  // (usePrompt/useDate คืนฟังก์ชันใหม่ทุก render จึงไม่อยู่ใน deps ของคอลัมน์นี้ — กฎ 20a)
  const actionsColumn = useMemo(
    () =>
      columnHelper.display({
        id: "actions",
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip ที่เปิดเมื่อ focus กลับมาที่ trigger กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
        cell: ({ row }) => <CodeActions id={row.original.id} revealOnce={revealOnce} onRevealed={setRevealed} />,
      }),
    [revealOnce]
  )

  // spec 08 AC-7: กรองสถานะด้วย filter ของ DataTable (radio = ค่าเดียว ตรงกับ `status` ของ API)
  // spec 10 กฎ 4e, 7: ย้ายเข้า component เพื่อแปล label — `value` ของตัวเลือก (ค่าใน URL/API) คงเป็นค่าดิบ
  const filters = useMemo(
    () => [
      filterHelper.accessor("status", {
        type: "radio",
        label: t("fields.status"),
        options: CODE_STATUSES.map((status) => ({
          label: t(`codeStatus.${status}`, { defaultValue: status }),
          value: status,
        })),
      }),
    ],
    [t]
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("code", {
        header: t("fields.code"),
        cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
      }),
      columnHelper.accessor("has_pin", {
        header: t("fields.pin"),
        cell: ({ getValue }) => (getValue() ? "****" : "-"),
      }),
      columnHelper.accessor("status", {
        header: t("fields.status"),
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={STATUS_COLOR[getValue()]}>
            {t(`codeStatus.${getValue()}`, { defaultValue: getValue() })}
          </Badge>
        ),
      }),
      columnHelper.accessor("expires_at", {
        header: t("fields.expires"),
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? getFullDate({ date: value }) : "-"
        },
      }),
      columnHelper.accessor("order_id", {
        header: t("fields.order"),
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      actionsColumn,
    ],
    [actionsColumn, getFullDate, t]
  )

  return (
    <Container data-testid="evoucher-codes">
      {/* กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง + filter; testid เฉพาะตอนล้ม */}
      <div data-testid={loadFailed ? "evoucher-codes-error" : undefined}>
        <PageOffsetGate prefix={PREFIX}>
          <DataTable
            data={data?.codes ?? []}
            columns={columns}
            filters={filters}
            getRowId={(code) => code.id}
            rowCount={data?.count ?? 0}
            isLoading={isLoading || pastLastPage}
            heading={t("codes.heading")}
            headingLevel="h2"
            prefix={PREFIX}
            pageSize={PAGE_SIZE}
            // spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results"/"2 of 1 pages" จาก rowCount 0)
            enablePagination={!loadFailed}
            enableSearch={false}
            emptyState={{
              empty: loadFailed
                ? { heading: t("codes.loadError"), description: error?.message }
                : { heading: t("codes.emptyHeading"), description: t("codes.emptyDescription") },
              // มี filter ใน URL → DataTable แสดง filtered แทน empty: ล้มแล้วต้องเป็น error เช่นกัน
              filtered: loadFailed
                ? { heading: t("codes.loadError"), description: error?.message }
                : { heading: t("codes.emptyHeading"), description: t("codes.filteredDescription") },
            }}
          />
        </PageOffsetGate>
      </div>

      <Drawer open={!!revealed} onOpenChange={(open) => !open && setRevealed(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("codes.revealedTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-4">
            {revealed && (
              <>
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    {t("fields.code")}
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
                    {t("fields.pin")}
                  </Text>
                  <Text className="font-mono">{revealed.pin ?? "-"}</Text>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  {t("codes.revealedNote", {
                    date: revealed.expires_at ? getFullDate({ date: revealed.expires_at }) : "-",
                  })}
                </Text>
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
