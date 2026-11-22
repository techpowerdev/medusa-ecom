// CORE-78 (spec 01 กฎข้อ 136d): แบ่งหน้าจาก `?page=` (1-based) ร่วมกันของ /account/orders (CORE-68) และ /account/vouchers (EV-7e)

/** ?page= (1-based) → page + offset; ค่าที่ไม่ใช่จำนวนเต็มบวก → หน้า 1 */
export const pageFromSearchParam = (page: string | string[] | undefined, pageSize: number) => {
  const n = typeof page === "string" && /^[1-9]\d*$/.test(page) ? Number(page) : 1
  return { page: n, offset: (n - 1) * pageSize }
}

/** จำนวนหน้าจาก count (อย่างน้อย 1 หน้า) */
export const totalPages = (count: number, pageSize: number) => Math.max(1, Math.ceil(count / pageSize))
