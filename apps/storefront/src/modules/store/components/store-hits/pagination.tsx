"use client"

import { usePagination } from "react-instantsearch"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"

const SearchPagination = () => {
  const { pages, currentRefinement, nbPages, refine, createURL } =
    usePagination({
      padding: 2,
    })

  if (nbPages <= 1) {
    return null
  }

  // SFUI-19c (spec 09 กฎ 66): `PaginationLink` ของ shadcn — href = URL ของหน้านั้นจาก routing ของ InstantSearch,
  // คลิกแล้ว refine เดิม (ไม่โหลดหน้าใหม่)
  const renderPage = (page: number) => (
    <PaginationItem key={page}>
      <PaginationLink
        href={createURL(page)}
        isActive={page === currentRefinement}
        // CORE-92 (spec 01 กฎข้อ 148c): ป้ายไทยสำหรับ screen reader + บอกหน้าปัจจุบัน แบบ `Pagination` (กฎข้อ 136c)
        aria-label={`หน้า ${page + 1}`}
        onClick={(event) => {
          event.preventDefault()
          refine(page)
        }}
      >
        {page + 1}
      </PaginationLink>
    </PaginationItem>
  )

  const renderEllipsis = (key: string) => (
    <PaginationItem key={key}>
      <span aria-hidden="true">...</span>
    </PaginationItem>
  )

  const lastPage = nbPages - 1

  return (
    <div className="flex justify-center w-full mt-12">
      <Pagination aria-label="แบ่งหน้า" data-testid="product-pagination">
        <PaginationContent>
          {!pages.includes(0) && renderPage(0)}
          {!pages.includes(0) && !pages.includes(1) && renderEllipsis("start")}
          {pages.map(renderPage)}
          {!pages.includes(lastPage) &&
            !pages.includes(lastPage - 1) &&
            renderEllipsis("end")}
          {!pages.includes(lastPage) && renderPage(lastPage)}
        </PaginationContent>
      </Pagination>
    </div>
  )
}

export default SearchPagination
