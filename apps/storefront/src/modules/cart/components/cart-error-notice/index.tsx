"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
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

  // SFUI-21e (spec 09 กฎ 74 (a)): Alert variant default (โทนกลาง ไม่ใช่ destructive — PAY-12) ระยะห่างภายนอก mb-6 คงเดิม
  return (
    <Alert className="mb-6" data-testid="cart-error-notice">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
