export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * FS-19 (#211) / FS-18: ประตูที่ test เปิดหลังตรวจสถานะรอแล้ว — route mock ตอบหลังครบเวลาหน่วง **และ**หลัง test ตรวจเสร็จ
 * (`await Promise.all([sleep(ms), checked.opened])`) หน้า/รูปโหลดช้าไม่แน่นอน ถ้าใช้เวลาหน่วงอย่างเดียว request อาจตอบก่อน test ได้ตรวจสถานะรอ
 */
export function gate() {
  let open!: () => void
  const opened = new Promise<void>((r) => (open = r))
  return { open, opened }
}
