import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-14 (spec 09 กฎ 38b, AC-39): `@keyframes enter` ของ starter ใน `@theme` (scale 0.9 + opacity) ชื่อชนกับ keyframe `enter`
// ของ tw-animate-css ที่ `animate-in` ของ shadcn ใช้ → Sheet/Dialog/Popover/Select ตอนเปิดซูมแบบ popup แทนการเลื่อน
// owner เห็นที่เมนู (`nav-menu-button` → Sheet side="left") — ตอนเปิดต้องเลื่อนเข้าจากซ้าย (translateX < 0 → 0) ไม่ scale
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-14" } })

type Sample = { t: number; animations: string[]; transform: string }

test("AC-39: เปิดเมนู (Sheet side=left) — ระหว่าง animation เลื่อนเข้าจากซ้าย ไม่ซูม", async ({ page, step, evidence }) => {
  let samples: Sample[] = []

  await step("เปิดหน้าแรก", async () => {
    await page.goto(`/${CC}`)
    await expect(page.getByTestId("nav-menu-button")).toBeVisible()
  })

  await step("คลิกเมนูแล้วเก็บ transform ของ nav-menu-popup ทุกเฟรมจน animation จบ", async () => {
    // เริ่มเก็บก่อนคลิก (popup ถูก mount หลังคลิก) — อ่าน computed transform ทุก requestAnimationFrame นานสุด 1.5 วินาที
    await page.evaluate(() => {
      const w = window as unknown as { __sfui14?: Promise<Sample[]> }
      w.__sfui14 = new Promise((resolve) => {
        const out: Sample[] = []
        const start = performance.now()
        const tick = () => {
          const el = document.querySelector<HTMLElement>('[data-testid="nav-menu-popup"]')
          const t = performance.now() - start
          if (el) {
            const running = el.getAnimations().filter((a) => a.playState === "running")
            out.push({
              t,
              animations: running.map((a) => (a as CSSAnimation).animationName ?? ""),
              transform: getComputedStyle(el).transform,
            })
            if (out.length > 3 && running.length === 0) return resolve(out)
          }
          if (t > 1500) return resolve(out)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    })
    await page.getByTestId("nav-menu-button").click()
    samples = await page.evaluate(() => (window as unknown as { __sfui14: Promise<Sample[]> }).__sfui14)
  })
  await expect(page.getByTestId("nav-menu-popup")).toBeVisible()
  await evidence("menu-open")

  const animating = samples.filter((s) => s.animations.length > 0 && s.transform !== "none")
  expect(animating.length, "มีเฟรมระหว่าง animation ของการเปิด").toBeGreaterThan(0)
  expect([...new Set(animating.flatMap((s) => s.animations))], "animation ของ tw-animate-css (animate-in)").toEqual(["enter"])
  const matrices = animating.map((s) => {
    const m = s.transform.match(/^matrix\(([^)]+)\)$/)
    return m ? m[1].split(",").map(Number) : null
  })
  // matrix(a, b, c, d, tx, ty): เลื่อนอย่างเดียว = a = d = 1, b = c = 0 และ tx < 0 (เข้าจากซ้าย)
  expect(
    matrices.filter((m) => !m || m[0] !== 1 || m[3] !== 1 || m[1] !== 0 || m[2] !== 0).length,
    `ไม่มีเฟรมที่ scale/rotate: ${animating.map((s) => s.transform).join(" | ")}`
  ).toBe(0)
  expect(
    matrices.some((m) => !!m && m[4] < 0),
    `มีเฟรมที่เลื่อนจากซ้าย (tx < 0): ${animating.map((s) => s.transform).join(" | ")}`
  ).toBe(true)
})
