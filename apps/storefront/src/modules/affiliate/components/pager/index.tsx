import Link from "next/link"

/** AF-8b: ลิงก์หน้าก่อน/ถัดไปของรายการแบบ limit/offset (programs, payouts) */
export default function Pager({ href, page, limit, count }: { href: string; page: number; limit: number; count: number }) {
  return (
    <div className="flex gap-x-6">
      {page > 1 && <Link href={`${href}?page=${page - 1}`}>หน้าก่อน</Link>}
      {page * limit < count && <Link href={`${href}?page=${page + 1}`}>หน้าถัดไป</Link>}
    </div>
  )
}
