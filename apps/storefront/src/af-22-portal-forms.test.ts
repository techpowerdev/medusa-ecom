import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// AF-22 (spec 05 กฎ 46, AC-54 static): ฟอร์มสมัคร/เข้าสู่ระบบของ portal ไม่ใช้ `<form action=>` ของ React 19
// (reset ฟอร์มหลัง action แม้ล้ม) แต่ใช้ `submitWithoutReset` ที่มีอยู่ (CORE-23b) และปุ่ม disabled จาก isPending
const source = readFileSync(
  path.resolve(__dirname, "modules/affiliate/components/auth-forms/index.tsx"),
  "utf8"
)

describe("AF-22 ฟอร์ม portal คงค่าหลัง error (กฎ 46)", () => {
  it("ไม่มี action={ บน <form และ import submitWithoutReset", () => {
    expect(source).not.toMatch(/<form[^>]*\saction=\{/)
    expect(source).toContain('import { submitWithoutReset } from "@lib/util/submit-without-reset"')
  })

  it.each(["login", "register"])("ฟอร์ม %s ผูก onSubmit={submitWithoutReset(...)} และปุ่มใช้ isPending", (name) => {
    expect(source).toMatch(new RegExp(`<form onSubmit=\\{submitWithoutReset\\(${name}Action\\)\\}`))
    expect(source).toMatch(new RegExp(`\\[${name}State, ${name}Action, ${name}Pending\\] = useActionState`))
    expect(source).toMatch(
      new RegExp(`<SubmitButton[^>]*isLoading=\\{${name}Pending\\}[^>]*data-testid="affiliate-${name}-submit"`)
    )
  })
})
