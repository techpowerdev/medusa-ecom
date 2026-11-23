import { ActionMenu } from "@medusajs/dashboard/components"
import { Trash } from "@medusajs/icons"
import { Badge, StatusBadge, toast, usePrompt } from "@medusajs/ui"
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { evoucherApi, evoucherKeys, Pool } from "../../lib/evoucher"
import { deletePoolPrompt, poolStockState } from "../../lib/evoucher-pool-delete"
import type { createSingleFlight } from "../../lib/single-flight"

const DELETE_KEY = ["evoucher", "pool-delete"]

type StockPool = Pick<Pool, "total_codes" | "low_stock" | "low_stock_threshold">

/**
 * EV-21 (spec 02 กฎข้อ 37): badge สต็อกของ pool ใช้ร่วมกันระหว่างตาราง pools และหน้า pool —
 * pool ไม่มี code เลย = StatusBadge สีเทา "No codes" แทน "Low stock" (กฎข้อ 36c); `showOk` = แสดง "OK" (คอลัมน์ Stock ของตาราง)
 */
export const PoolStockBadge = ({ pool, showOk = false }: { pool: StockPool; showOk?: boolean }) => {
  const state = poolStockState(pool)
  if (state === "no_codes") {
    return (
      <StatusBadge color="grey" data-testid="evoucher-pool-no-codes">
        No codes
      </StatusBadge>
    )
  }
  if (state === "low") {
    return (
      <Badge size="2xsmall" color="red" data-testid="evoucher-pool-low-stock">
        Low stock (&lt; {pool.low_stock_threshold})
      </Badge>
    )
  }
  return showOk ? (
    <Badge size="2xsmall" color="green">
      OK
    </Badge>
  ) : null
}

/**
 * EV-21 (กฎข้อ 37): Delete ของ pool ใน ActionMenu ของ dashboard → usePrompt (ระบุจำนวน code) → DELETE → toast
 * 400 ของกฎข้อ 36a/36d → toast ข้อความจาก API; `deleteOnce` (single-flight ของผู้เรียก) ครอบทั้ง prompt + request กันกดซ้ำ
 * และ Delete disabled ระหว่างลบใดๆ ยังไม่จบ (mutationKey เดียวกัน — แบบ PartnerActions); `children` = trigger (มี testid)
 */
export const PoolDeleteMenu = ({
  pool,
  deleteOnce,
  onDeleted,
  children,
}: {
  pool: Pick<Pool, "id" | "name" | "total_codes">
  deleteOnce: ReturnType<typeof createSingleFlight>
  onDeleted?: () => void
  children: ReactNode
}) => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const removing = useIsMutating({ mutationKey: DELETE_KEY }) > 0
  // ไม่ refetch รายละเอียดของ pool ที่เพิ่งลบ (หน้า pool ยัง mount อยู่ระหว่างกลับรายการ → GET 404)
  const refetchPools = () =>
    queryClient.invalidateQueries({
      queryKey: evoucherKeys.pools,
      predicate: (query) => query.queryKey[2] !== pool.id,
    })
  const remove = useMutation({
    mutationKey: DELETE_KEY,
    mutationFn: () => evoucherApi.deletePool(pool.id),
    onSuccess: () => {
      toast.success("Voucher pool deleted")
      onDeleted?.()
      return refetchPools()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      return refetchPools()
    },
  })

  const confirmDelete = () =>
    deleteOnce(async () => {
      const ok = await prompt(deletePoolPrompt(pool))
      if (ok) {
        await remove.mutateAsync().catch(() => undefined)
      }
    })

  return (
    <ActionMenu
      groups={[{ actions: [{ label: "Delete", icon: <Trash />, disabled: removing, onClick: confirmDelete }] }]}
    >
      {children}
    </ActionMenu>
  )
}
