import { readFileSync } from "fs"
import path from "path"

// PAY-24 (spec 06 กฎข้อ 27, AC-37 static): ผู้ส่งอีเมลหา OPS_ALERT_EMAIL เดิม 3 ที่ใช้ sendOpsAlert
// (helper soft-delete แถว `failure` ก่อนส่งใหม่ — Notification module 2.22.1 ส่งซ้ำแถว failure ไม่หยุด)
const SENDERS = [
  "src/subscribers/payment-webhook-orphan.ts",
  "src/subscribers/group-buy-payment-captured.ts",
  "src/workflows/group-buy/membership-payment.ts",
]
const backendRoot = path.resolve(__dirname, "../../..")

describe.each(SENDERS)("%s", (file) => {
  const source = readFileSync(path.join(backendRoot, file), "utf8")

  it("does not read OPS_ALERT_EMAIL or call createNotifications for the ops alert directly", () => {
    expect(source).not.toMatch(/process\.env\.OPS_ALERT_EMAIL/)
    expect(source).not.toMatch(/\.createNotifications\(/)
  })

  it("sends the ops alert through sendOpsAlert", () => {
    expect(source).toMatch(/import \{[^}]*\bsendOpsAlert\b[^}]*\} from "[./]+\/lib\/ops-alert"/)
    expect(source).toMatch(/\bsendOpsAlert\(/)
  })
})
