import { HttpTypes } from "@medusajs/types"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  return (
    <p
      data-testid={dataTestid}
      data-value={dataValue}
      className="inline-block text-sm text-muted-foreground w-full overflow-hidden text-ellipsis"
    >
      ตัวเลือก: {variant?.title}
    </p>
  )
}

export default LineItemOptions
