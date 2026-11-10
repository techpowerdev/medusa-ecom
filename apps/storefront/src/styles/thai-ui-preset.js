// [CORE-8] spec 01 กฎข้อ 14: class typography ของ @medusajs/ui-preset (txt-*, h*-webs, h*-core, h*-docs)
// fix font-family เป็น "Inter, ..." ผ่าน addComponents → ห่อ handler ของ plugin ใน preset ให้เติม
// Noto Sans Thai ไว้หน้า Inter ก่อนส่งให้ Tailwind (ไม่ patch node_modules; code-* ที่เป็น Roboto Mono ไม่แตะ)
// ใช้จาก tailwind.config.js (CommonJS)
//
// TODO(Tailwind v4): wrapper นี้ผูกกับ plugin API ของ Tailwind v3 (`{ handler, config }` + addComponents)
// เมื่อ @medusajs/ui-preset ย้ายไป Tailwind v4 (CSS-first) ต้องทบทวนใหม่ทั้งหมด — อาจเหลือแค่ override
// ตัวแปร/`@theme` ใน CSS แทน
const THAI_FONT = "var(--font-noto-sans-thai)"

const withThaiFont = (styles) =>
  Array.isArray(styles)
    ? styles.map(withThaiFont)
    : Object.fromEntries(
        Object.entries(styles).map(([selector, decls]) => [
          selector,
          typeof decls?.fontFamily === "string" &&
          decls.fontFamily.startsWith("Inter")
            ? { ...decls, fontFamily: `${THAI_FONT}, ${decls.fontFamily}` }
            : decls,
        ])
      )

const isWrappable = (plugin) => typeof plugin?.handler === "function"

function withThaiUiPreset(preset) {
  const plugins = Array.isArray(preset?.plugins) ? preset.plugins : []

  // fail fast ตอนโหลด config: ถ้าโครงสร้าง preset เปลี่ยนจนห่อไม่ได้ ให้ build ล้มทันที
  // แทนที่จะข้ามเงียบแล้วกลับไปใช้ Inter โดยไม่มีใครรู้
  if (!plugins.some(isWrappable)) {
    throw new Error(
      "[CORE-8] ไม่พบ plugin รูป { handler } ใน @medusajs/ui-preset — ห่อ font-family ไม่ได้ " +
        "(โครงสร้าง preset เปลี่ยน? ดู src/styles/thai-ui-preset.js)"
    )
  }

  return {
    ...preset,
    plugins: plugins.map((plugin) =>
      !isWrappable(plugin)
        ? plugin
        : {
            ...plugin,
            handler: (api) =>
              plugin.handler({
                ...api,
                addComponents: (styles, options) =>
                  api.addComponents(withThaiFont(styles), options),
              }),
          }
    ),
  }
}

module.exports = { withThaiUiPreset }
