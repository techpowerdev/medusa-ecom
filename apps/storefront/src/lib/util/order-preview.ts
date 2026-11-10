// spec 01 กฎข้อ 43: order card แสดงสินค้าสูงสุด 3 line และนับ line ที่ไม่ได้แสดง (ไม่ใช่ quantity)
const MAX_SHOWN = 3

export const orderPreview = <T>(items: T[] | null | undefined) => {
  const all = items ?? []
  return {
    shown: all.slice(0, MAX_SHOWN),
    moreCount: Math.max(all.length - MAX_SHOWN, 0),
  }
}
