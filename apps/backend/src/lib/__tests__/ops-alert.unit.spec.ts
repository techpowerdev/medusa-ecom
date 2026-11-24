import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendOpsAlert } from "../ops-alert"

// PAY-20 (spec 06 กฎข้อ 22c–d): helper แจ้ง ops — กันส่งซ้ำด้วย idempotency_key, log error หนึ่งบรรทัด, trim env, warn เมื่อไม่ตั้ง, catch การส่ง
describe("sendOpsAlert", () => {
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
  const notification = { listNotifications: jest.fn(), createNotifications: jest.fn(), softDeleteNotifications: jest.fn() }
  const container = {
    resolve: (key: string) => ({ [ContainerRegistrationKeys.LOGGER]: logger, [Modules.NOTIFICATION]: notification })[key],
  } as any
  const alert = {
    code: "REFUND_FAILED",
    template: "refund-failed",
    idempotency_key: "refund-alert:ref_1",
    resource_type: "payment",
    resource_id: "pay_1",
    data: { refund_id: "ref_1", payment_id: "pay_1", amount: "500", note: null },
  }

  beforeEach(() => {
    jest.resetAllMocks()
    notification.listNotifications.mockResolvedValue([])
    notification.createNotifications.mockResolvedValue({})
  })

  it("logs one error line starting with the code and sends an email with the idempotency key (env trimmed)", async () => {
    await expect(sendOpsAlert(container, alert, { OPS_ALERT_EMAIL: "  ops@x.test " })).resolves.toBe("sent")

    expect(notification.listNotifications).toHaveBeenCalledWith({ idempotency_key: "refund-alert:ref_1" }, expect.anything())
    expect(logger.error).toHaveBeenCalledTimes(1)
    const line = String(logger.error.mock.calls[0][0])
    expect(line.startsWith("REFUND_FAILED ")).toBe(true)
    expect(line).toContain("refund_id=ref_1")
    expect(line).toContain("payment_id=pay_1")
    expect(line).toContain("amount=500")
    expect(notification.createNotifications).toHaveBeenCalledWith({
      to: "ops@x.test",
      channel: "email",
      template: "refund-failed",
      data: { code: "REFUND_FAILED", ...alert.data },
      idempotency_key: "refund-alert:ref_1",
      resource_type: "payment",
      resource_id: "pay_1",
    })
  })

  it("an existing notification of the key (not failure) → duplicate: no log, no send", async () => {
    notification.listNotifications.mockResolvedValue([{ id: "noti_1", status: "success" }])

    await expect(sendOpsAlert(container, alert, { OPS_ALERT_EMAIL: "ops@x.test" })).resolves.toBe("duplicate")

    expect(logger.error).not.toHaveBeenCalled()
    expect(notification.createNotifications).not.toHaveBeenCalled()
  })

  it("a previous failed notification of the key → soft-deleted before alerting again (review #550: Medusa 2.22.1 cannot retry it in place)", async () => {
    notification.listNotifications.mockResolvedValue([{ id: "noti_1", status: "failure" }])

    await expect(sendOpsAlert(container, alert, { OPS_ALERT_EMAIL: "ops@x.test" })).resolves.toBe("sent")
    expect(notification.softDeleteNotifications).toHaveBeenCalledWith(["noti_1"])
    expect(notification.softDeleteNotifications.mock.invocationCallOrder[0]).toBeLessThan(
      notification.createNotifications.mock.invocationCallOrder[0]
    )
    expect(notification.createNotifications).toHaveBeenCalledTimes(1)
  })

  it("no previous failure → nothing is soft-deleted", async () => {
    await sendOpsAlert(container, alert, { OPS_ALERT_EMAIL: "ops@x.test" })
    expect(notification.softDeleteNotifications).not.toHaveBeenCalled()
  })

  it.each([{}, { OPS_ALERT_EMAIL: "   " }])("OPS_ALERT_EMAIL not set (%p) → error log + warn, no send", async (env) => {
    await expect(sendOpsAlert(container, alert, env)).resolves.toBe("skipped")

    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(String(logger.warn.mock.calls[0][0])).toMatch(/^REFUND_FAILED: OPS_ALERT_EMAIL is not set/)
    expect(notification.createNotifications).not.toHaveBeenCalled()
  })

  it("send throws → does not throw, logs an error with the cause", async () => {
    notification.createNotifications.mockRejectedValue(new Error("resend down"))

    await expect(sendOpsAlert(container, alert, { OPS_ALERT_EMAIL: "ops@x.test" })).resolves.toBe("failed")
    expect(logger.error.mock.calls.some(([msg]) => /^REFUND_FAILED: OPS_ALERT_EMAIL send failed: resend down/.test(String(msg)))).toBe(true)
  })
})
