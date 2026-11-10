const BASE_OPTIONS = 10

/**
 * CORE-44 (spec 01 กฎข้อ 102b): ตัวเลือกจำนวนของ line ใน /cart = 1..10 และจำนวนจริงของ line เมื่อ > 10
 * (เรียงน้อยไปมาก ไม่มีค่าซ้ำ) — ไม่ตั้งเพดานเอง: Medusa ตรวจ stock ตอน `updateLineItem`
 */
export const cartQuantityOptions = (quantity: number): number[] => {
  const options = Array.from({ length: BASE_OPTIONS }, (_, i) => i + 1)
  return quantity > BASE_OPTIONS ? [...options, quantity] : options
}
