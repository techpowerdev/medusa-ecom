import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchFormProps = {
  countryCode: string
  defaultValue?: string
  className?: string
}

/** Plain GET form so search works without JavaScript and for browser agents. */
const SearchForm = ({ countryCode, defaultValue, className }: SearchFormProps) => (
  <form
    role="search"
    method="get"
    action={`/${countryCode}/search`}
    className={cn("flex gap-2", className)}
    {...{
      toolname: "search_products",
      tooldescription: "Search the store's products by keyword",
    }}
  >
    <label htmlFor="search-q" className="sr-only">
      ค้นหาสินค้า
    </label>
    {/* SFUI-19c (spec 09 กฎ 65a): ตัวอย่าง docs "Input with button" ของ shadcn */}
    <Input
      id="search-q"
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder="ค้นหาสินค้า"
      data-testid="search-query-input"
    />
    <Button type="submit" data-testid="search-submit">
      ค้นหา
    </Button>
  </form>
)

export default SearchForm
