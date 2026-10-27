import { readFileSync } from "node:fs"
import path from "node:path"
import type { FormEvent } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-4h (spec 01 กฎข้อ 69c, review #162): guard ของ useSubmitOnce — เรียก hook เป็นฟังก์ชันตรงๆ
// โดย mock react ให้ useRef คืน object เดิมทุก render (เหมือน component ตัวเดิม) และ useEffect เรียก callback ทันที
const ref = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return {
    ...actual,
    useRef: (initial: unknown) => {
      if (ref.current === undefined) ref.current = initial
      return ref
    },
    useEffect: (effect: () => void) => effect(),
  }
})

const submit = (onSubmit: (e: FormEvent<HTMLFormElement>) => void) => {
  const preventDefault = vi.fn()
  onSubmit({ preventDefault } as unknown as FormEvent<HTMLFormElement>)
  return preventDefault.mock.calls.length > 0
}

describe("useSubmitOnce (กฎข้อ 69c)", () => {
  beforeEach(() => {
    ref.current = undefined
  })

  it("submit แรกผ่าน, submit ที่สองก่อน/ระหว่าง action ทำงานถูก preventDefault", async () => {
    const { useSubmitOnce } = await import("@lib/hooks/use-submit-once")
    const idle = useSubmitOnce(false)
    expect(submit(idle)).toBe(false)
    // คลิกที่สองมาก่อน React re-render เป็น pending (handler ของ render เดิม)
    expect(submit(idle)).toBe(true)
    // re-render ระหว่าง action ทำงาน
    const pending = useSubmitOnce(true)
    expect(submit(pending)).toBe(true)
  })

  it("action จบ (isPending → false) แล้ว submit ถัดไปผ่าน — ref ไม่ค้าง", async () => {
    const { useSubmitOnce } = await import("@lib/hooks/use-submit-once")
    expect(submit(useSubmitOnce(false))).toBe(false)
    useSubmitOnce(true)
    const done = useSubmitOnce(false)
    expect(submit(done)).toBe(false)
    expect(submit(done)).toBe(true)
  })
})

// ถอด hook ออกจากฟอร์ม login/register แล้ว test นี้ต้องล้ม (static — renderToStaticMarkup ไม่แสดง onSubmit)
describe("ฟอร์ม login/register ใช้ useSubmitOnce", () => {
  it.each(["login", "register"])("%s ผูก onSubmit ของ useSubmitOnce(isPending) กับ <form>", (name) => {
    const source = readFileSync(
      path.resolve(__dirname, `modules/account/components/${name}/index.tsx`),
      "utf8"
    )
    expect(source).toMatch(/\[message, formAction, isPending\] = useActionState/)
    expect(source).toContain("const onSubmit = useSubmitOnce(isPending)")
    expect(source).toMatch(/<form[^>]*action=\{formAction\} onSubmit=\{onSubmit\}/)
  })
})
