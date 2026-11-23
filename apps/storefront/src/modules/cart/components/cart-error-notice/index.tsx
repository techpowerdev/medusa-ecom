"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * PAY-12 (spec 06 กฎข้อ 14): ข้อความไทยของ `?error=` บนหน้าตะกร้า
 * PAY-18 (กฎข้อ 20c): ลูกค้าแก้ตะกร้าสำเร็จครั้งแรก (server action revalidate แล้ว `itemsKey` เปลี่ยน) → ลบ `error` ออกจาก URL
 * ด้วย `router.replace` (ไม่เพิ่ม history) หน้า cart render ใหม่โดยไม่มี notice; แก้ไม่สำเร็จ → cart เดิม → notice คงอยู่
 */
export default function CartErrorNotice({ message, itemsKey }: { message: string; itemsKey: string }) {
  const router = useRouter()
  const initialKey = useRef(itemsKey)

  useEffect(() => {
    if (itemsKey === initialKey.current) {
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false })
  }, [itemsKey, router])

  return (
    <p
      role="alert"
      className="txt-medium mb-6 rounded-rounded bg-ui-bg-subtle p-3 text-ui-fg-base"
      data-testid="cart-error-notice"
    >
      {message}
    </p>
  )
}
