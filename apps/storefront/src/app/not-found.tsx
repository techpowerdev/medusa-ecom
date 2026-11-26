import { ArrowUpRight } from "lucide-react"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "404 ไม่พบหน้านี้",
  description: "ไม่พบหน้าที่คุณต้องการ",
}

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1
        className="text-2xl-semi text-foreground"
        data-testid="not-found-title"
      >
        ไม่พบหน้านี้
      </h1>
      <p
        className="text-small-regular text-foreground"
        data-testid="not-found-description"
      >
        หน้าที่คุณพยายามเข้าถึงไม่มีอยู่
      </p>
      <Link
        className="flex gap-x-1 items-center group"
        href="/"
        data-testid="not-found-home-link"
      >
        <p className="text-sm leading-[1.4rem] text-primary">กลับไปหน้าแรก</p>
        <ArrowUpRight className="size-4 text-primary group-hover:rotate-45 ease-in-out duration-150" />
      </Link>
    </div>
  )
}
