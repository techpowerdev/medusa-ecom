import { runOnce } from "../in-flight"

// GB-6a D1 (qa): คลิก Create 5 ครั้งใน JS task เดียวต้องยิง API ครั้งเดียว — React ยังไม่ re-render
// ระหว่างคลิก จึงพึ่ง isPending ไม่ได้ ต้องกันด้วย flag ที่ตั้งแบบ synchronous (useRef) ก่อน mutate
describe("runOnce", () => {
  it("runs once for repeated synchronous calls while in flight", () => {
    const flag = { current: false }
    const run = jest.fn()
    const results = Array.from({ length: 5 }, () => runOnce(flag, run))
    expect(run).toHaveBeenCalledTimes(1)
    expect(results).toEqual([true, false, false, false, false])
    expect(flag.current).toBe(true)
  })

  it("runs again after the flag is released (onSettled)", () => {
    const flag = { current: false }
    const run = jest.fn()
    runOnce(flag, run)
    flag.current = false
    expect(runOnce(flag, run)).toBe(true)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
