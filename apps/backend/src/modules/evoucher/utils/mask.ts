const VISIBLE = 4
const MIN_LENGTH_TO_SHOW_TAIL = 8

/** แสดง 4 ตัวท้ายเฉพาะ code ที่ยาว ≥ 8 ตัว (ซ่อนอย่างน้อยครึ่งหนึ่งเสมอ) */
export function maskSecret(value: string): string {
  const visible = value.length >= MIN_LENGTH_TO_SHOW_TAIL ? VISIBLE : 0
  return "*".repeat(Math.max(value.length - visible, 1)) + value.slice(value.length - visible)
}
