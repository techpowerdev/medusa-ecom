// CORE-68 (spec 01 กฎข้อ 126): แบ่งหน้า order ปกติในหน้า /account/orders จาก count ของ GET /store/orders
export const ORDERS_PAGE_SIZE = 10

/** ?page= (1-based) → page + offset; ค่าที่ไม่ใช่จำนวนเต็มบวก → หน้า 1 */
export const ordersPage = (page: string | string[] | undefined) => {
  const n = typeof page === "string" && /^[1-9]\d*$/.test(page) ? Number(page) : 1
  return { page: n, offset: (n - 1) * ORDERS_PAGE_SIZE }
}

/** จำนวนหน้าจาก count (อย่างน้อย 1 หน้า — หน้าเกินจำนวนถูกพาไปหน้าสุดท้าย) */
export const ordersTotalPages = (count: number) =>
  Math.max(1, Math.ceil(count / ORDERS_PAGE_SIZE))
