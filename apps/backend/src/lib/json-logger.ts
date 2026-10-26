import type { Logger } from "@medusajs/framework/types"
import { Reporter } from "@medusajs/cli/dist/reporter"
import type { Writable } from "stream"
import winston from "winston"

type Env = Record<string, string | undefined>

/**
 * OPS-3 (spec 07 AC-18, ADR-012 ภาคผนวก): logger JSON ของ Medusa (`Reporter` ตัวเดียวกับ default) ที่ทุกบรรทัดมี
 * `worker_mode` จาก `MEDUSA_WORKER_MODE` — ให้กฎ alert `Error running event bus worker` กรองเฉพาะ process worker ได้
 * ส่งเข้า Medusa ผ่าน option `logger` ของ `defineConfig` (ไม่แตะ logger/event bus ของ Medusa)
 * format เดียวกับ default ของ Medusa 2.22.1 (`@medusajs/cli/dist/reporter`) รวม `LOG_LEVEL`/`LOG_FILE`
 * development คืน `undefined` → Medusa ใช้ logger เดิม (format CLI + spinner)
 */
export function buildJsonLogger(env: Env, stream?: Writable): Logger | undefined {
  const nodeEnv = env.NODE_ENV || "development"
  if (nodeEnv.startsWith("dev")) {
    return undefined
  }

  const workerMode = env.MEDUSA_WORKER_MODE || "shared"
  const transports: winston.transport[] = [
    stream ? new winston.transports.Stream({ stream }) : new winston.transports.Console(),
  ]
  if (env.LOG_FILE) {
    transports.push(new winston.transports.File({ filename: env.LOG_FILE }))
  }

  const instance = winston.createLogger({
    level: env.LOG_LEVEL || "http",
    levels: winston.config.npm.levels,
    format: winston.format.combine(
      winston.format((info) => Object.assign(info, { worker_mode: workerMode }))(),
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    transports,
  })

  // activityLogger (ora) ใช้เฉพาะ development ซึ่งไม่ถึงตรงนี้
  return new Reporter({ logger: instance, activityLogger: undefined }) as unknown as Logger
}
