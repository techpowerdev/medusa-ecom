import { describe, expect, it, vi } from "vitest"

import { withActionFallback } from "./action-fallback"

// CORE-23c (spec 01 กฎข้อ 74a/b): server action ที่ล้มระดับ network/5xx ทำให้ promise ฝั่ง client reject
// → useActionState โยนเข้า error boundary ("This page couldn't load") — wrapper คืนผล error ไทยแทน
const THAI = /[฀-๿]/

describe("withActionFallback", () => {
  it("action สำเร็จ → คืนผลเดิม", async () => {
    const action = vi.fn(async () => ({ success: true, error: null }))
    const wrapped = withActionFallback(action)
    const form = new FormData()
    await expect(wrapped({ x: 1 }, form)).resolves.toEqual({ success: true, error: null })
    expect(action).toHaveBeenCalledWith({ x: 1 }, form)
  })

  it("action reject (network/5xx) → คืน { success: false, error ไทย } และ console.error", async () => {
    const failure = new TypeError("Failed to fetch")
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const wrapped = withActionFallback(async () => {
        throw failure
      })
      const result = await wrapped({}, new FormData())
      expect(result.success).toBe(false)
      expect(result.error).toMatch(THAI)
      expect(log).toHaveBeenCalledWith(failure)
    } finally {
      log.mockRestore()
    }
  })
})
