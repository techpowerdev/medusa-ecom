// SFUI-6 (CLAUDE.md ข้อ 3 — ผู้ใช้ 2 ที่): วงกลมตัวเลือกที่วาดเองในแถว RadioGroupItem ของ checkout
// (ตัวเลือกจัดส่ง SFUI-3e, ตัวเลือกชำระเงิน SFUI-3d — indicator ของ shadcn ถูกซ่อน) ต้องอยู่ใต้ element ที่มี class `group`
// และ `data-state` ของ Radix (checked → พื้น primary + จุดกลาง)
const OptionDot = () => (
  <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary">
    <span className="hidden size-1.5 rounded-full bg-primary-foreground group-data-[state=checked]:block" />
  </span>
)

export default OptionDot
