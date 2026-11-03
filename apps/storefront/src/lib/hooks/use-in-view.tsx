import { RefObject, useEffect, useState } from "react"

export const useIntersection = (
  element: RefObject<HTMLDivElement | null>,
  rootMargin: string
) => {
  // CORE-25 (กฎข้อ 78): null = ยังไม่รู้ (SSR/ก่อน observer ตอบครั้งแรก) — ผู้ใช้ต้องไม่ถือว่า "ไม่อยู่ในจอ"
  const [isVisible, setState] = useState<boolean | null>(null)

  useEffect(() => {
    if (!element.current) {
      return
    }

    const el = element.current

    const observer = new IntersectionObserver(
      ([entry]) => {
        setState(entry.isIntersecting)
      },
      { rootMargin }
    )

    observer.observe(el)

    return () => observer.unobserve(el)
  }, [element, rootMargin])

  return isVisible
}
