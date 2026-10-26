import { Metadata } from "next"

import InteractiveLink from "@modules/common/components/interactive-link"

export const metadata: Metadata = {
  title: "404",
  description: "ไม่พบตะกร้าสินค้า",
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">ไม่พบหน้านี้</h1>
      <p className="text-small-regular text-ui-fg-base">
        ไม่พบตะกร้าสินค้าที่คุณต้องการเปิด ลองล้างคุกกี้แล้วลองใหม่อีกครั้ง
      </p>
      <InteractiveLink href="/">กลับหน้าแรก</InteractiveLink>
    </div>
  )
}
