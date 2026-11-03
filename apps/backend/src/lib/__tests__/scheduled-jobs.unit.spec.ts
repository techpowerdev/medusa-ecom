import fs from "fs"
import path from "path"
import { isFileDisabled } from "@medusajs/framework/utils"
import { scheduledJobsDisabled } from "../scheduled-jobs"

// OPS-15b (spec 07 AC-26): cron ของ job ใน integration test รันซ้อนกับการ restore DB ของ medusa-test-utils
// แล้ว connection ถูก terminate (knex log ว่า connection ถูกปิด) — test ทุกตัวเรียก job function ตรงอยู่แล้ว
// จึงไม่ลงทะเบียน cron เมื่อ integration-tests/setup.js ตั้ง MEDUSA_DISABLE_SCHEDULED_JOBS=true
const FLAG = "MEDUSA_DISABLE_SCHEDULED_JOBS"
const JOBS_DIR = path.resolve(__dirname, "../../jobs")
const jobFiles = fs
  .readdirSync(JOBS_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => path.join(JOBS_DIR, name))

describe("scheduledJobsDisabled", () => {
  it("ปิดเมื่อตั้ง flag เป็น true", () => {
    expect(scheduledJobsDisabled({ [FLAG]: "true" })).toBe(true)
  })

  it("เปิดตามปกติเมื่อไม่ตั้ง flag หรือค่าอื่น", () => {
    expect(scheduledJobsDisabled({})).toBe(false)
    expect(scheduledJobsDisabled({ [FLAG]: "1" })).toBe(false)
  })

  it("production ไม่ฟัง flag — job ของ deadline/รายวันต้องทำงานเสมอ", () => {
    expect(scheduledJobsDisabled({ NODE_ENV: "production", [FLAG]: "true" })).toBe(false)
  })
})

describe("job ทุกไฟล์ใน src/jobs ผูก defineFileConfig กับ flag", () => {
  const original = process.env[FLAG]
  afterEach(() => {
    if (original === undefined) {
      delete process.env[FLAG]
    } else {
      process.env[FLAG] = original
    }
  })

  it("พบไฟล์ job", () => {
    expect(jobFiles.length).toBeGreaterThan(0)
  })

  it.each(jobFiles.map((file) => [path.basename(file), file]))("%s", (_name, file) => {
    require(file)
    process.env[FLAG] = "true"
    expect(isFileDisabled(file)).toBe(true)
    delete process.env[FLAG]
    expect(isFileDisabled(file)).toBe(false)
  })
})
