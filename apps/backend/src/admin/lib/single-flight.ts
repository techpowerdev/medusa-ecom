/**
 * EV-9 (กฎข้อ 11): กัน submit ซ้ำในฟอร์ม admin — คลิกซ้อน (dblclick) เกิดใน tick เดียวก่อน `isPending`
 * ของ react-query เป็น true จึงต้องมี flag นอก state; ระหว่าง `fn` ยังไม่จบ การเรียกซ้ำถูกข้าม
 * ใช้ใน component: `const [submitOnce] = useState(createSingleFlight)`
 *
 * ADM-39 (spec 08 กฎ 43): ฟอร์มสร้างที่ปิด `FocusModal` หลังสำเร็จ — ปุ่ม Save และ ⌘/Ctrl+Enter ยังทำงานได้ระหว่างแอนิเมชันปิด
 * จึงเรียก `hold()` ใน `fn` เมื่อ request สำเร็จ: lock ค้างไว้แม้ `fn` จบแล้ว จนกว่าจะ `release()` ตอนเปิดฟอร์มใหม่
 * (`fn` ล้มหรือจบโดยไม่ `hold()` เช่น validation ฝั่ง client = ปล่อยทันที ลองใหม่ได้)
 */
export const createSingleFlight = () => {
  let pending = false
  let held = false
  const run = async (fn: () => Promise<unknown>) => {
    if (pending || held) {
      return
    }
    pending = true
    try {
      await fn()
    } finally {
      pending = false
    }
  }
  return Object.assign(run, {
    hold: () => {
      held = true
    },
    release: () => {
      held = false
    },
  })
}
