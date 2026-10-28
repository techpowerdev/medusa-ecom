import type { Affiliate } from "./affiliate"

// AF-14 (spec 05 กฎ 38): Ledger/Payouts แสดงชื่อ + อีเมลของ affiliate — ดึงเฉพาะ id ของแถวในหน้าปัจจุบัน 1 request ต่อหน้า
export type AffiliateName = Pick<Affiliate, "id" | "name" | "email">

export const affiliateNamesQuery = (rows: { affiliate_id: string }[]) => {
  const id = [...new Set(rows.map((row) => row.affiliate_id))].sort()
  return id.length ? { id, limit: id.length, offset: 0, fields: "id,name,email" } : null
}

/** แนบ `affiliate: { name, email }` ให้แถวที่หาเจอ; หาไม่เจอ → ไม่แนบ (UI แสดง affiliate_id เดิม) */
export const withAffiliateNames = <T extends { affiliate_id: string }>(
  rows: T[],
  affiliates: AffiliateName[] | undefined,
): (T & { affiliate?: Pick<Affiliate, "name" | "email"> })[] => {
  if (!affiliates) {
    return rows
  }
  const byId = new Map(affiliates.map(({ id, name, email }) => [id, { name, email }]))
  return rows.map((row) => {
    const affiliate = byId.get(row.affiliate_id)
    return affiliate ? { ...row, affiliate } : row
  })
}
