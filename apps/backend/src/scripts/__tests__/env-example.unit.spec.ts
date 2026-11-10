import { readFileSync } from "fs"
import path from "path"

// CORE-10 AC-31 (spec 01 กฎข้อ 18): .env.example ของ backend ไม่มีรหัส admin ตัวอย่าง
describe(".env.example", () => {
  const envExample = readFileSync(path.resolve(__dirname, "../../../.env.example"), "utf8")
  const lines = envExample.split(/\r?\n/)

  it("AC-31 has SEED_ADMIN_PASSWORD= with no value", () => {
    const entries = lines.filter((line) => /^\s*SEED_ADMIN_PASSWORD\s*=/.test(line))
    expect(entries).toEqual(["SEED_ADMIN_PASSWORD="])
  })
})
