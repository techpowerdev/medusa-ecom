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
