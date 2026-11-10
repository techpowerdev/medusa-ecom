import { container } from "@medusajs/framework"
import { releaseIdlePgConnections } from "./pg-pool"

// OPS-15 (spec 07 AC-26): beforeEach ระดับบนสุดรันก่อน beforeEach ของ medusaIntegrationTestRunner
// (ที่ snapshot/restore DB และ terminate connection) — ปล่อย pool ของ app ก่อน เพื่อไม่ให้เหลือ connection ที่ตายใน pool
beforeEach(async () => {
  await releaseIdlePgConnections(container)
})
