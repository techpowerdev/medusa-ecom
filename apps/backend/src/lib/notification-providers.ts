// provider ของ Notification Module (ใช้ใน medusa-config.ts)
// - มี RESEND_API_KEY → channel "email" ส่งผ่าน Resend; "feed" (admin dashboard) ยังใช้ local ตาม default ของ Medusa
// - ไม่มี key (dev/test/CI) → local provider ของ Medusa รับทั้ง "feed" และ "email" (log แทนการส่งจริง)
type Env = Record<string, string | undefined>

const LOCAL_PROVIDER = "@medusajs/medusa/notification-local"

export const buildNotificationProviders = (env: Env) => {
  if (!env.RESEND_API_KEY) {
    return [
      {
        resolve: LOCAL_PROVIDER,
        id: "local",
        options: { name: "Local Notification Provider", channels: ["feed", "email"] },
      },
    ]
  }

  return [
    {
      resolve: LOCAL_PROVIDER,
      id: "local",
      options: { name: "Local Notification Provider", channels: ["feed"] },
    },
    {
      resolve: "./src/modules/resend",
      id: "resend",
      options: {
        channels: ["email"],
        api_key: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL,
        // EV-4: ถอด code/PIN ของ e-voucher ตอน render อีเมล (notification.data เก็บ ciphertext)
        evoucher_encryption_key: env.EVOUCHER_ENCRYPTION_KEY,
      },
    },
  ]
}
