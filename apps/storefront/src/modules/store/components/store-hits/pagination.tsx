"use client"

import { usePagination } from "react-instantsearch"

import { clx } from "@modules/common/components/ui"

const SearchPagination = () => {
  const { pages, currentRefinement, nbPages, refine } = usePagination({
    padding: 2,
  })

  if (nbPages <= 1) {
    return null
  }

  const renderPage = (page: number) => (
    <button
      key={page}
      className={clx("txt-xlarge-plus text-ui-fg-muted", {
        "text-ui-fg-base hover:text-ui-fg-subtle": page === currentRefinement,
      })}
      disabled={page === currentRefinement}
      // CORE-92 (spec 01 กฎข้อ 148c): ป้ายไทยสำหรับ screen reader + บอกหน้าปัจจุบัน แบบ `Pagination` (กฎข้อ 136c)
      aria-label={`หน้า ${page + 1}`}
      aria-current={page === currentRefinement ? "page" : undefined}
      onClick={() => refine(page)}
    >
      {page + 1}
    </button>
  )

  const renderEllipsis = (key: string) => (
    <span
      key={key}
      aria-hidden="true"
      className="txt-xlarge-plus text-ui-fg-muted items-center cursor-default"
    >
      ...
    </span>
  )

  const lastPage = nbPages - 1

  return (
    <div className="flex justify-center w-full mt-12">
      <nav
        aria-label="แบ่งหน้า"
        className="flex gap-3 items-end"
        data-testid="product-pagination"
      >
        {!pages.includes(0) && renderPage(0)}
        {!pages.includes(0) && !pages.includes(1) && renderEllipsis("start")}
        {pages.map(renderPage)}
        {!pages.includes(lastPage) &&
          !pages.includes(lastPage - 1) &&
          renderEllipsis("end")}
        {!pages.includes(lastPage) && renderPage(lastPage)}
      </nav>
    </div>
  )
}

export default SearchPagination
