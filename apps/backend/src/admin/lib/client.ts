import Medusa from "@medusajs/js-sdk"

// SDK ของ admin extension — ใช้ session ของ admin dashboard (ห้ามใช้ fetch() ตรง)
// admin ถูก serve จาก backend เดียวกัน (/app, ไม่ตั้ง admin.backendUrl) จึงใช้ "/"
// ไม่ใช้ import.meta.env เพราะ tsconfig ราก (module Node16/CJS) typecheck src/admin ด้วย → TS1470
export const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session",
  },
})
