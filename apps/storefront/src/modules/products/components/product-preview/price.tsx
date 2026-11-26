import { cn } from "@/lib/utils"
import { VariantPrice } from "types/global"

export default async function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null
  }

  return (
    <>
      {price.price_type === "sale" && (
        <p
          className="text-sm leading-[1.4rem] line-through text-muted-foreground"
          data-testid="original-price"
        >
          {price.original_price}
        </p>
      )}
      <p
        className={cn("text-sm leading-[1.4rem] text-muted-foreground", {
          "text-primary": price.price_type === "sale",
        })}
        data-testid="price"
      >
        {price.calculated_price}
      </p>
    </>
  )
}
