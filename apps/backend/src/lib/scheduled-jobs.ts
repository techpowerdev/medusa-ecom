// OPS-15b (spec 07 AC-26): integration-tests/setup.js ตั้ง flag นี้ — cron ที่รันเองซ้อนกับการ restore DB ของ
// medusa-test-utils ทำให้ connection ถูก terminate; test เรียก job function ตรงแทน
// production ไม่ฟัง flag เพื่อไม่ให้ deadline/งานรายวันหยุดเงียบเพราะตั้ง env ผิด
export function scheduledJobsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.MEDUSA_DISABLE_SCHEDULED_JOBS === "true"
}
