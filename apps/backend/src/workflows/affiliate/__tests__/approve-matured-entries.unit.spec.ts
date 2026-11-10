import { logCancelReconcile } from "../approve-matured-entries"

// AF-N2 (กฎ 32b/c, AC-38): ระดับ/ถ้อยคำ log ของการ reverse order ที่ยกเลิกแล้วใน maturity job
const spyLogger = () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() })
const transaction = (finished: boolean) => ({ hasFinished: () => finished })

describe("logCancelReconcile", () => {
  it("does not log 'failed' at error level while the reversal workflow is still retrying", () => {
    const logger = spyLogger()

    logCancelReconcile(logger, "order_1", { result: undefined, errors: [], transaction: transaction(false) })

    expect(logger.error).not.toHaveBeenCalled()
    const lines = [...logger.warn.mock.calls, ...logger.info.mock.calls].map(([m]) => String(m))
    expect(lines.some((m) => /failed/i.test(m))).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("order_1"))
  })

  it("still treats a retrying run as not completed even when errors of the attempt are reported", () => {
    const logger = spyLogger()

    logCancelReconcile(logger, "order_1", { result: undefined, errors: [new Error("db")], transaction: transaction(false) })

    expect(logger.error).not.toHaveBeenCalled()
  })

  it("logs an error with 'failed' once the workflow has really failed", () => {
    const logger = spyLogger()

    logCancelReconcile(logger, "order_1", { result: undefined, errors: [new Error("db")], transaction: transaction(true) })

    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/order_1.*failed/))
  })

  it("warns affiliate_cancel_reconciled when reversals were created", () => {
    const logger = spyLogger()

    logCancelReconcile(logger, "order_1", { result: [{}, {}], errors: [], transaction: transaction(true) })

    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/affiliate_cancel_reconciled.*order_1/))
  })

  it("logs info affiliate_cancel_reconcile_noop when the net is already <= 0", () => {
    const logger = spyLogger()

    logCancelReconcile(logger, "order_1", { result: [], errors: [], transaction: transaction(true) })

    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/affiliate_cancel_reconcile_noop.*order_1/))
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
