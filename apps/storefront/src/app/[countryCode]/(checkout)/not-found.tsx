import InteractiveLink from "@modules/common/components/interactive-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "404 ไม่พบหน้านี้",
  description: "ไม่พบหน้าที่คุณต้องการ",
}

export default async function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base" data-testid="not-found-title">
        ไม่พบหน้านี้
      </h1>
      <p className="text-small-regular text-ui-fg-base" data-testid="not-found-description">
        หน้าที่คุณพยายามเข้าถึงไม่มีอยู่
      </p>
      <InteractiveLink href="/" data-testid="not-found-home-link">
        กลับไปหน้าแรก
      </InteractiveLink>
    </div>
  )
}
