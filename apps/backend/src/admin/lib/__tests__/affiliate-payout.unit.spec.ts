import { canCancelPayout, singleFlight } from "../affiliate-payout"

// AF-6 (spec 05 AC-26): ปุ่มยกเลิกเฉพาะ payout `draft` และกันกดซ้ำ (dblclick → request เดียว)
describe("canCancelPayout", () => {
  it("is true only for draft payouts", () => {
    expect(canCancelPayout({ status: "draft" })).toBe(true)
    expect(canCancelPayout({ status: "paid" })).toBe(false)
  })
})

describe("singleFlight", () => {
  it("ignores calls while the previous call is still running", async () => {
    let release!: () => void
    const fn = jest.fn((_id: string) => new Promise<void>((resolve) => (release = resolve)))
    const run = singleFlight(fn)

    const first = run("a")
    void run("b")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("a")

    release()
    await first
    void run("c")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("allows another call after the previous one rejects", async () => {
    const fn = jest.fn(async () => undefined).mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined)
    const run = singleFlight(fn)

    await expect(run()).rejects.toThrow("boom")
    await run()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
