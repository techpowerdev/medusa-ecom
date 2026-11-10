// `medusa start` โหลดไฟล์นี้แล้วเรียก register() ทั้งโหมด server และ worker
// (https://docs.medusajs.com/learn/debugging-and-testing/instrumentation)
// OPS-20b (spec 07 AC-32): ไม่ใช้ `registerOtel` (ต้องเพิ่ม `@opentelemetry/*` + exporter/collector — ข้อห้ามข้อ 3)
// เปิดเฉพาะ sampler event-loop delay ของ load run (`LOG_LEVEL=debug`) — prod ไม่มี timer
import { logger as defaultLogger } from "@medusajs/framework/logger"
import { buildJsonLogger } from "./src/lib/json-logger"
import { startSaturationSampler } from "./src/lib/saturation-sampler"

export function register() {
  if (process.env.LOG_LEVEL !== "debug") {
    return undefined
  }
  // register() ถูกเรียกก่อน container โหลด logger ของ config → สร้าง JSON logger แบบเดียวกับ OPS-3 (field worker_mode)
  const logger = buildJsonLogger(process.env) ?? defaultLogger
  return startSaturationSampler({ env: process.env, logger })
}
