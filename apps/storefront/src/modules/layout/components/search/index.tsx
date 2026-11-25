"use client"

import { Search as SearchIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import type { SearchClient } from "instantsearch.js"
import {
  Configure,
  InstantSearch,
  useHits,
  useInstantSearch,
  useSearchBox,
} from "react-instantsearch"

import useSearchSettled from "@lib/hooks/use-search-settled"
import useToggleState from "@lib/hooks/use-toggle-state"
import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import SearchDrawer from "./drawer"
import SearchHit, { ProductHit } from "./hit"

const HITS_PER_PAGE = 12
const DEBOUNCE_MS = 250

const SearchPanel = ({ onNavigate }: { onNavigate: () => void }) => {
  const timer = useRef<number | undefined>(undefined)

  const queryHook = useCallback(
    (nextQuery: string, search: (value: string) => void) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => search(nextQuery), DEBOUNCE_MS)
    },
    []
  )

  const { query, refine } = useSearchBox({ queryHook })
  const { items } = useHits<ProductHit>()
  // CORE-15b (กฎข้อ 76): catchError — ไม่มีใครรับ error ของ search แล้ว InstantSearch โยนเป็น uncaught (pageerror)
  // ที่นี่แสดง search-drawer-error แทน และ log 1 บรรทัด (ไม่มี stack) ต่อ error เพื่อ debug
  const { status, error } = useInstantSearch({ catchError: true })
  const { isSettled } = useSearchSettled()

  const [inputValue, setInputValue] = useState(query)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (error) {
      console.error(`[search-drawer] search request failed: ${error.message}`)
    }
  }, [error])

  const hasInput = Boolean(inputValue.trim())
  const isPending = inputValue.trim() !== query.trim()
  const hasResults = Boolean(query.trim()) && items.length > 0

  return (
    <>
      <div className="flex items-center gap-x-3 border-b px-4">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value)
            refine(event.target.value)
          }}
          placeholder="ค้นหาสินค้า"
          aria-label="ค้นหาสินค้า"
          autoFocus
          className="text-sm leading-[1.4rem] w-full bg-transparent py-4 text-foreground outline-hidden placeholder:text-muted-foreground"
          data-testid="search-input"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!hasInput ? (
          <p
            className="px-4 py-6 text-sm leading-[1.4rem] text-center text-muted-foreground"
            data-testid="search-empty"
          >
            พิมพ์เพื่อค้นหาสินค้า
          </p>
        ) : status === "error" ? (
          <p
            className="px-4 py-6 text-sm leading-[1.4rem] text-center text-destructive"
            data-testid="search-drawer-error"
          >
            ค้นหาสินค้าไม่สำเร็จ
          </p>
        ) : !isSettled ? (
          <p
            className="px-4 py-6 text-sm leading-[1.4rem] text-center text-muted-foreground"
            data-testid="search-loading"
          >
            กำลังค้นหา&hellip;
          </p>
        ) : hasResults ? (
          <ul className="py-2" data-testid="search-results">
            {items.map((hit) => (
              <SearchHit key={hit.objectID} hit={hit} onNavigate={onNavigate} />
            ))}
          </ul>
        ) : isPending || !query.trim() ? (
          <p
            className="px-4 py-6 text-sm leading-[1.4rem] text-center text-muted-foreground"
            data-testid="search-loading"
          >
            กำลังค้นหา&hellip;
          </p>
        ) : (
          <p
            className="px-4 py-6 text-sm leading-[1.4rem] text-center text-muted-foreground [overflow-wrap:anywhere]"
            data-testid="search-no-results"
          >
            ไม่พบสินค้าสำหรับ &quot;{query}&quot;
          </p>
        )}
      </div>
    </>
  )
}

const Search = () => {
  const { state: isOpen, open, close } = useToggleState()
  const { countryCode } = useParams<{ countryCode: string }>()
  const buttonRef = useRef<HTMLAnchorElement>(null)

  return (
    <>
      {/* A real link so search works without JavaScript; with JS it opens the drawer instead. */}
      <Link
        ref={buttonRef}
        href={`/${countryCode}/search`}
        onClick={(event) => {
          event.preventDefault()
          open()
        }}
        aria-label="ค้นหาสินค้า"
        className="flex items-center hover:text-foreground"
        data-testid="nav-search-button"
      >
        {/* 15px = ขนาดเดิมของ MagnifyingGlass — core-50 เทียบตำแหน่ง/ขนาดของ nav-search-button กับ develop */}
        <SearchIcon className="size-[15px]" />
      </Link>

      <SearchDrawer isOpen={isOpen} close={close} returnFocusRef={buttonRef}>
        <InstantSearch
          indexName={PRODUCT_INDEX_NAME}
          searchClient={searchClient as unknown as SearchClient}
          future={{ preserveSharedStateOnUnmount: true }}
        >
          <Configure hitsPerPage={HITS_PER_PAGE} />
          <SearchPanel onNavigate={close} />
        </InstantSearch>
      </SearchDrawer>
    </>
  )
}

export default Search
