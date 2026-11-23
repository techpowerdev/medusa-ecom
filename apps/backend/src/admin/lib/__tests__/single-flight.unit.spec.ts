import { createSingleFlight } from "../single-flight"

// EV-9 (กฎข้อ 11, AC-20): ฟอร์ม admin กดซ้ำ/dblclick ระหว่างส่ง → ส่งจริงครั้งเดียว
describe("createSingleFlight", () => {
  it("ignores calls while the first one is still pending", async () => {
    const run = createSingleFlight()
    let release!: () => void
    const fn = jest.fn(() => new Promise<void>((resolve) => (release = resolve)))

    const first = run(fn)
    const second = run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    release()
    await Promise.all([first, second])
  })

  it("allows a new call after the previous one settles, even when it failed", async () => {
    const run = createSingleFlight()
    await expect(run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom")
    const fn = jest.fn(() => Promise.resolve())
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ADM-39 (spec 08 กฎ 43, AC-44): ฟอร์มสร้างที่ปิด FocusModal หลังสำเร็จ — lock ค้างจนเปิดฟอร์มใหม่ (release)
// dblclick เว้น 100ms / ⌘+Enter หลัง response ระหว่าง modal กำลังปิด ต้องไม่ยิงซ้ำ
describe("createSingleFlight hold/release", () => {
  it("keeps the lock after hold() even when fn has settled", async () => {
    const run = createSingleFlight()
    const fn = jest.fn(async () => run.hold())
    await run(fn)
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("release() lets the next call through (form reopened)", async () => {
    const run = createSingleFlight()
    const fn = jest.fn(async () => run.hold())
    await run(fn)
    run.release()
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does not hold when fn fails (request error → retry allowed)", async () => {
    const run = createSingleFlight()
    const fail = () => Promise.reject(new Error("500")).then(() => run.hold())
    await expect(run(fail)).rejects.toThrow("500")
    const fn = jest.fn(() => Promise.resolve())
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does not hold when fn returns without hold() (client validation error)", async () => {
    const run = createSingleFlight()
    await run(async () => undefined)
    const fn = jest.fn(() => Promise.resolve())
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("release() while a call is in flight does not let a second call through", async () => {
    const run = createSingleFlight()
    let resolve!: () => void
    const fn = jest.fn(() => new Promise<void>((r) => (resolve = r)))
    const first = run(fn)
    run.release()
    await run(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    resolve()
    await first
  })
})

// EV-21 D1 (qa #454): ตาราง pools อ่านสถานะ pending เพื่อไม่นำทางจากคลิกแถวระหว่าง prompt/การลบ
describe("createSingleFlight isPending", () => {
  it("is true only while fn is running", async () => {
    const run = createSingleFlight()
    expect(run.isPending()).toBe(false)
    let release!: () => void
    const done = run(() => new Promise<void>((resolve) => (release = resolve)))
    expect(run.isPending()).toBe(true)
    release()
    await done
    expect(run.isPending()).toBe(false)
  })
})

// ADM-46 (spec 08 กฎ 50, AC-51): ปุ่ม Save disabled ตลอดช่วงที่ lock ถูก hold (ระหว่างแอนิเมชันปิด) — React อ่านสถานะผ่าน subscribe/isLocked
describe("createSingleFlight isLocked/subscribe", () => {
  it("is locked while fn runs and stays locked after hold() until release()", async () => {
    const run = createSingleFlight()
    expect(run.isLocked()).toBe(false)
    let resolve!: () => void
    const done = run(() => new Promise<void>((r) => (resolve = r)).then(run.hold))
    expect(run.isLocked()).toBe(true)
    resolve()
    await done
    expect(run.isLocked()).toBe(true)
    run.release()
    expect(run.isLocked()).toBe(false)
  })

  it("unlocks after fn settles without hold() (request error / client validation)", async () => {
    const run = createSingleFlight()
    await expect(run(() => Promise.reject(new Error("500")))).rejects.toThrow("500")
    expect(run.isLocked()).toBe(false)
    await run(async () => undefined)
    expect(run.isLocked()).toBe(false)
  })

  it("notifies subscribers on every lock change and stops after unsubscribe", async () => {
    const run = createSingleFlight()
    const seen: boolean[] = []
    const unsubscribe = run.subscribe(() => seen.push(run.isLocked()))
    await run(async () => run.hold())
    run.release()
    expect(seen).toEqual([true, true, true, false])
    unsubscribe()
    await run(async () => undefined)
    expect(seen).toHaveLength(4)
  })
})
