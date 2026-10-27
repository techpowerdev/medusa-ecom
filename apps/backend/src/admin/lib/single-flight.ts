/**
 * EV-9 (กฎข้อ 11): กัน submit ซ้ำในฟอร์ม admin — คลิกซ้อน (dblclick) เกิดใน tick เดียวก่อน `isPending`
 * ของ react-query เป็น true จึงต้องมี flag นอก state; ระหว่าง `fn` ยังไม่จบ การเรียกซ้ำถูกข้าม
 * ใช้ใน component: `const [submitOnce] = useState(createSingleFlight)`
 */
export const createSingleFlight = () => {
  let pending = false
  return async (fn: () => Promise<unknown>) => {
    if (pending) {
      return
    }
    pending = true
    try {
      await fn()
    } finally {
      pending = false
    }
  }
}
