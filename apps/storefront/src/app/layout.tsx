import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Noto_Sans_Thai } from "next/font/google"
import "styles/globals.css"

// [CORE-4a] ADR-008 ข้อ 4: next/font ดาวน์โหลดฟอนต์ตอน build แล้ว self-host (ไม่มี request ไป Google Fonts ตอน runtime)
// ใช้ผ่าน CSS variable ที่ tailwind.config.js ตั้งเป็น fontFamily.sans ตัวแรก
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="th" data-mode="light" className={notoSansThai.variable}>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
