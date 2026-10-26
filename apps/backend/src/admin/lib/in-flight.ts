// กันกดซ้ำ (CLAUDE.md): flag ตั้งแบบ synchronous ก่อน run — คลิกหลายครั้งใน JS task เดียวยังเห็น isPending เดิม
// ใช้คู่กับ useRef(false) และปลด flag ใน onSettled ของ mutation (pattern เดียวกับ FS-10)
export const runOnce = (flag: { current: boolean }, run: () => void) => {
  if (flag.current) {
    return false
  }
  flag.current = true
  run()
  return true
}
