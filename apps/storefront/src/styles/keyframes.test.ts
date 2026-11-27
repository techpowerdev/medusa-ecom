import fs from "node:fs"
import path from "node:path"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

// SFUI-14 (spec 09 กฎ 38b, AC-39): keyframe ของ globals.css ต้องไม่ชื่อชนกับ keyframe ของ tw-animate-css
// (`@keyframes` ชื่อเดียวกัน → ตัวที่มาทีหลังทับทั้งก้อน: เดิม `enter` ของ starter (scale 0.9) ทับ `enter` ที่ `animate-in` ของ shadcn ใช้)
const GLOBALS = path.join(__dirname, "globals.css")
const TW_ANIMATE = path.join(__dirname, "../../node_modules/tw-animate-css/dist/tw-animate.css")

function keyframeNames(file: string): string[] {
  const names: string[] = []
  postcss.parse(fs.readFileSync(file, "utf8")).walkAtRules("keyframes", (rule) => {
    names.push(rule.params.trim())
  })
  return names
}

describe("globals.css — keyframe ไม่ชนกับ tw-animate-css (SFUI-14)", () => {
  it("tw-animate-css มี keyframe enter/exit ที่ animate-in/animate-out ใช้", () => {
    expect(keyframeNames(TW_ANIMATE)).toEqual(expect.arrayContaining(["enter", "exit"]))
  })

  it("globals.css ไม่ประกาศ keyframe enter/exit หรือชื่ออื่นที่ tw-animate-css ใช้", () => {
    const ours = keyframeNames(GLOBALS)
    expect(ours).not.toContain("enter")
    expect(ours).not.toContain("exit")
    expect(ours.filter((name) => keyframeNames(TW_ANIMATE).includes(name))).toEqual([])
  })
})
