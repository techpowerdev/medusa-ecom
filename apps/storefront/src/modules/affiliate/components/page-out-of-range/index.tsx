import Link from "next/link"

/** AF-N3 (spec 05 กฎ 40c): `?page=` เกินจำนวนหน้าของรายการ (programs, payouts) → บอกผู้ใช้และพากลับหน้าแรก */
export default function PageOutOfRange({ href }: { href: string }) {
  return (
    <div className="flex flex-col gap-y-2" data-testid="affiliate-page-out-of-range">
      <p>ไม่มีรายการในหน้านี้ เลขหน้าเกินจำนวนหน้าที่มี</p>
      <Link href={href} className="underline" data-testid="affiliate-page-out-of-range-first">
        กลับไปหน้าแรก
      </Link>
    </div>
  )
}
