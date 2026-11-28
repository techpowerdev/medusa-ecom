import { ActionMenu, DataTable, Form, KeyboundForm, NoRecords } from "@medusajs/dashboard/components"
import { zodResolver } from "@hookform/resolvers/zod"
import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import {
  Button,
  createDataTableColumnHelper,
  Drawer,
  FocusModal,
  Heading,
  IconButton,
  Input,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { evoucherApi, evoucherKeys, Partner, PartnerInput } from "../../lib/evoucher"
import {
  PARTNER_PARSE_OPTIONS,
  partnerFormSchema,
  type PartnerFormValues,
  toPartnerFormValues,
} from "../../lib/evoucher-partner-form"
import { isUnauthorized } from "../../lib/fetch-error"
import { isPastLastPage } from "../../lib/page-offset"
import { createSingleFlight, useSingleFlight } from "../../lib/single-flight"
import { Container } from "../common/container"
import { usePageOffset } from "../common/use-page-offset"
import { PageOffsetGate } from "../common/page-offset-gate"
import { useConfirmDiscard } from "../common/use-confirm-discard"
import { useRemountMenu } from "../common/use-remount-menu"
import { useRestoreOpenerFocus } from "../common/use-restore-opener-focus"

const columnHelper = createDataTableColumnHelper<Partner>()
const PAGE_SIZE = 20
// spec 08 กฎ 9: prefix ไม่ซ้ำกับตาราง pools ในหน้าเดียวกัน — หน้าปัจจุบันอยู่ใน URL (`partners_offset`)
const PREFIX = "partners"
const DELETE_KEY = ["evoucher", "partner-delete"]

const PartnerFields = () => {
  // spec 10 กฎ 4e: รายการช่องย้ายเข้า component เพื่อแปล label (ลำดับ/ชื่อช่องเดิม)
  const { t } = useTranslation("ecom-evoucher")
  const fields: { name: keyof PartnerFormValues; label: string }[] = [
    { name: "name", label: t("fields.nameRequired") },
    { name: "logo_url", label: t("fields.logoUrl") },
    { name: "terms_url", label: t("fields.termsUrl") },
    { name: "support_contact", label: t("fields.supportContact") },
  ]
  return (
    <div className="flex flex-col gap-y-4">
      {fields.map(({ name, label }) => (
        <Form.Field
          key={name}
          name={name}
          render={({ field }) => (
            <Form.Item>
              <Form.Label>{label}</Form.Label>
              <Form.Control>
                <Input {...field} size="small" />
              </Form.Control>
              <Form.ErrorMessage data-testid={`evoucher-partner-${name}-error`} />
            </Form.Item>
          )}
        />
      ))}
    </div>
  )
}

/**
 * ADM-16 (spec 08 กฎ 20a): Edit/Delete ต่อแถวใน ActionMenu — ถือ prompt/mutation ลบของแถวเอง (แบบ `ProgramActions`)
 * guard `deleteOnce` มาจากตาราง (ตัวเดียวทั้งตาราง) และ Delete disabled ทุกแถวระหว่างลบใดๆ ยังไม่จบ (mutationKey เดียวกัน)
 */
const PartnerActions = ({
  partner,
  deleteOnce,
  onEdit,
}: {
  partner: Partner
  deleteOnce: ReturnType<typeof createSingleFlight>
  onEdit: (partner: Partner) => void
}) => {
  const { t } = useTranslation("ecom-evoucher")
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const removing = useIsMutating({ mutationKey: DELETE_KEY }) > 0
  // เปิด Drawer จาก menuitem: remount เมนู (spec 08 กฎ 27b) + focus ปุ่ม … ตัวใหม่ให้ Drawer คืน focus เมื่อปิด (กฎ 51)
  const { menuKey, remountMenu, trigger } = useRemountMenu()
  const remove = useMutation({
    mutationKey: DELETE_KEY,
    mutationFn: () => evoucherApi.deletePartner(partner.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evoucherKeys.partners })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
      toast.success(t("partners.deleted"))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // guard ครอบทั้ง prompt + request — กด Delete ซ้ำระหว่างรอ prompt/request ไม่ยิงซ้ำ
  const confirmDelete = () =>
    deleteOnce(async () => {
      const ok = await prompt({
        title: t("partners.deleteTitle", { name: partner.name }),
        description: t("partners.deleteDescription"),
        confirmText: t("actions.delete", { ns: "translation" }),
        cancelText: t("actions.cancel", { ns: "translation" }),
      })
      if (ok) {
        await remove.mutateAsync().catch(() => undefined)
      }
    })

  return (
    <ActionMenu
      key={menuKey}
      groups={[
        {
          actions: [
            {
              label: t("actions.edit", { ns: "translation" }),
              icon: <PencilSquare />,
              disabled: removing,
              onClick: () => {
                remountMenu()
                onEdit(partner)
              },
            },
            { label: t("actions.delete", { ns: "translation" }), icon: <Trash />, disabled: removing, onClick: confirmDelete },
          ],
        },
      ]}
    >
      <IconButton ref={trigger} size="small" variant="transparent" data-testid="evoucher-partner-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// EV-6: พาร์ทเนอร์ของ e-voucher — ADM-5: DataTable ของ dashboard (แบ่งหน้าใน URL), Edit/Delete ใน ActionMenu,
// ฟอร์มเป็น Form + zod (สร้าง = FocusModal, แก้ = Drawer แบบ state — ADR-018 Q5)
export const PartnersSection = () => {
  const { t } = useTranslation("ecom-evoucher")
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้วแปลงเป็น body ด้วย schema เดียวกันตอน submit (แบบ ADM-3)
  const form = useForm({
    resolver: zodResolver(partnerFormSchema, PARTNER_PARSE_OPTIONS, { raw: true }),
    defaultValues: toPartnerFormValues(),
  })
  // spec 02 กฎข้อ 11 / spec 08 กฎ 4: dblclick / ⌘+Enter ซ้ำก่อน isPending เป็น true → request ครั้งเดียว
  // กฎ 43 (ADM-39): สำเร็จแล้ว lock ค้าง (hold) ระหว่าง modal/Drawer กำลังปิด — ปล่อย (release) ตอนเปิดฟอร์มใหม่
  // กฎ 50 (ADM-46): `submitLocked` = in-flight หรือ hold — Save disabled ตลอดช่วงแอนิเมชันปิด
  const [submitOnce, submitLocked] = useSingleFlight()
  const [deleteOnce] = useState(createSingleFlight)

  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })
  const query = { limit: PAGE_SIZE, offset }
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...evoucherKeys.partners, query],
    queryFn: () => evoucherApi.listPartners(query),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])

  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data
  // กฎ 27a: offset เกินที่ usePageOffset กำลัง clamp → loading แทน empty state
  const pastLastPage = isPastLastPage(data?.count, data?.partners.length)

  const onSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: evoucherKeys.partners })
    queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
    toast.success(message)
    setCreateOpen(false)
    setEditing(null)
  }
  const onError = (e: Error) => toast.error(e.message)

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: PartnerInput }) =>
      id ? evoucherApi.updatePartner(id, body) : evoucherApi.createPartner(body),
    onSuccess: (_, { id }) => onSuccess(id ? t("partners.updated") : t("partners.created")),
    onError,
  })

  // กดซ้ำขณะ modal เปิดอยู่ไม่ล้างค่าที่กรอกไว้ (spec 08 กฎ 18)
  const openCreate = () => {
    if (createOpen) return
    form.reset(toPartnerFormValues())
    submitOnce.release()
    setCreateOpen(true)
  }

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount แถวใหม่และเมนูที่เปิดอยู่ปิดเองตอน refetch
  // (usePrompt คืนฟังก์ชันใหม่ทุก render จึงอยู่ใน PartnerActions ไม่อยู่ใน deps ของคอลัมน์นี้ — กฎ 20a)
  const actionsColumn = useMemo(
    () => {
      const openEdit = (partner: Partner) => {
        form.reset(toPartnerFormValues(partner))
        submitOnce.release()
        setEditing(partner)
      }
      return columnHelper.display({
        id: "actions",
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip ที่เปิดเมื่อ focus กลับมาที่ trigger กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
        // spec 08 กฎ 39 (ADM-35): ทุก td ได้ width จาก size (ค่าเริ่มต้น 150 ของ tanstack) — ตารางนี้มี 3 คอลัมน์ ผลรวมน้อยกว่าความกว้าง
        // ของตาราง w-full → Chrome แจกส่วนเกินให้ทุกคอลัมน์ตามสัดส่วนโดยไม่สน max-width (ชื่อกว้าง 428px) — ไม่ตั้ง width ที่คอลัมน์นี้
        // ให้เป็นคอลัมน์ auto ที่รับส่วนเกินแทน (ปุ่มยังชิดซ้ายของคอลัมน์)
        size: undefined,
        cell: ({ row }) => <PartnerActions partner={row.original} deleteOnce={deleteOnce} onEdit={openEdit} />,
      })
    },
    [form, deleteOnce, submitOnce]
  )

  const columns = useMemo(
    () => [
      // spec 08 กฎ 39 (ADM-35): เนื้อหา 250px (แบบ ProductCell ของ dashboard) — DataTable เป็น auto layout + nowrap คอลัมน์จึงขยายตามข้อความ
      // จนปุ่ม … หลุดจอ; size/maxSize เป็น width/max-width ของ td (border-box) จึงบวก padding: คอลัมน์แรก pl-6+pr-6 = 298, คอลัมน์อื่น pr-6 = 274
      // ข้อความที่ถูกตัดยังมี tooltip ของ TruncatedCell
      columnHelper.accessor("name", { header: t("fields.name"), size: 298, maxSize: 298 }),
      columnHelper.accessor("support_contact", {
        header: t("fields.supportContact"),
        size: 274,
        maxSize: 274,
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      actionsColumn,
    ],
    [actionsColumn, t]
  )

  const submit = form.handleSubmit((values) =>
    submitOnce(() =>
      save
        .mutateAsync({ id: editing?.id, body: partnerFormSchema.parse(values, PARTNER_PARSE_OPTIONS) })
        .then(submitOnce.hold, () => undefined)
    )
  )

  // ADM-34 (spec 08 กฎ 38): ปิดแล้ว focus กลับปุ่มที่เปิด — ตัวเดียวใช้ทั้ง modal สร้างและ Drawer แก้ (เปิดพร้อมกันไม่ได้; กฎ 51)
  const restoreFocus = useRestoreOpenerFocus()
  // ADM-27 (spec 08 กฎ 31): ฟอร์มเดียวของ modal สร้างและ Drawer แก้ — dirty ถามก่อนปิด; ระหว่างบันทึกไม่ปิด
  const confirmClose = useConfirmDiscard({
    form,
    isPending: save.isPending,
    onClose: () => {
      setCreateOpen(false)
      setEditing(null)
    },
  })

  const saveButton = (
    <Button
      size="small"
      type="submit"
      disabled={submitLocked}
      isLoading={save.isPending}
      data-testid="evoucher-partner-save"
    >
      {t("actions.save", { ns: "translation" })}
    </Button>
  )

  return (
    <Container data-testid="evoucher-partners">
      {/* spec 08 กฎ 18: `action` ของ DataTable ใส่ data-testid ไม่ได้ — e2e หาปุ่มด้วย role + ชื่อภายใน wrapper นี้ */}
      <div data-testid="evoucher-partners-table">
        {/* กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง + ปุ่ม Create partner; testid เฉพาะตอนล้ม */}
        <div data-testid={loadFailed ? "evoucher-partners-error" : undefined}>
          <PageOffsetGate prefix={PREFIX}>
            <DataTable
              data={data?.partners ?? []}
              columns={columns}
              getRowId={(partner) => partner.id}
              rowCount={data?.count ?? 0}
              isLoading={isLoading || pastLastPage}
              heading={t("partners.heading")}
              headingLevel="h2"
              action={{ label: t("partners.create"), onClick: openCreate }}
              prefix={PREFIX}
              pageSize={PAGE_SIZE}
              // spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results"/"2 of 1 pages" จาก rowCount 0)
              enablePagination={!loadFailed}
              enableSearch={false}
              emptyState={{
                empty: loadFailed
                  ? { heading: t("partners.loadError"), description: error?.message }
                  : {
                      custom: (
                        <div data-testid="evoucher-partners-empty">
                          <NoRecords title={t("partners.emptyTitle")} message={t("partners.emptyMessage")} />
                        </div>
                      ),
                    },
              }}
            />
          </PageOffsetGate>
        </div>
      </div>

      <FocusModal open={createOpen} onOpenChange={confirmClose}>
        <FocusModal.Content {...restoreFocus}>
          {/* noValidate: validation ทั้งหมดเป็นของ zod (error ใต้ช่อง) */}
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={submit} className="flex h-full flex-col overflow-hidden">
              <FocusModal.Header>
                <div className="flex items-center justify-end gap-x-2">{saveButton}</div>
              </FocusModal.Header>
              <FocusModal.Body className="flex flex-1 justify-center overflow-auto py-16">
                <div className="flex w-full max-w-lg flex-col gap-y-6">
                  <FocusModal.Title asChild>
                    <Heading>{t("partners.create")}</Heading>
                  </FocusModal.Title>
                  <PartnerFields />
                </div>
              </FocusModal.Body>
            </KeyboundForm>
          </Form>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={!!editing} onOpenChange={confirmClose}>
        <Drawer.Content {...restoreFocus}>
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
              <Drawer.Header>
                <Drawer.Title>{t("partners.edit")}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex-1 overflow-auto p-4">
                <PartnerFields />
              </Drawer.Body>
              <Drawer.Footer>
                <div className="flex items-center justify-end gap-x-2">
                  <Drawer.Close asChild>
                    <Button size="small" variant="secondary" type="button" disabled={save.isPending}>
                      {t("actions.cancel", { ns: "translation" })}
                    </Button>
                  </Drawer.Close>
                  {saveButton}
                </div>
              </Drawer.Footer>
            </KeyboundForm>
          </Form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
