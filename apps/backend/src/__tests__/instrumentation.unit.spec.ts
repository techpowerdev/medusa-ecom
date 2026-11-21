// OPS-20b (spec 07 AC-32): `medusa start` โหลด instrumentation.ts แล้วเรียก register() ทั้งโหมด server และ worker
// register() เปิด sampler event-loop delay เฉพาะ LOG_LEVEL=debug — ไม่ตั้ง → ไม่สร้าง interval (prod ไม่มี timer)
import { register } from "../../instrumentation"

describe("instrumentation.ts register() (OPS-20b)", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    jest.restoreAllMocks()
  })

  it("ไม่ตั้ง LOG_LEVEL=debug → ไม่สร้าง interval", () => {
    delete process.env.LOG_LEVEL
    const spy = jest.spyOn(global, "setInterval")
    register()
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(["http", "info"])("LOG_LEVEL=%s (http = ค่าเริ่มต้นของ compose prod — OPS-30) → ไม่สร้าง interval", (level) => {
    process.env.LOG_LEVEL = level
    const spy = jest.spyOn(global, "setInterval")
    register()
    expect(spy).not.toHaveBeenCalled()
  })

  it("LOG_LEVEL=debug → สร้าง interval หนึ่งตัว (หยุดได้)", () => {
    process.env.LOG_LEVEL = "debug"
    const spy = jest.spyOn(global, "setInterval")
    const stop = register()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(typeof stop).toBe("function")
    stop?.()
  })
})
