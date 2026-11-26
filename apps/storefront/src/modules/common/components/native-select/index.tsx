import { cn } from "@/lib/utils"
import { ChevronsUpDown } from "lucide-react"
import {
  SelectHTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

export type NativeSelectProps = {
  placeholder?: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
} & SelectHTMLAttributes<HTMLSelectElement>

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { placeholder = "เลือก...", defaultValue, className, children, ...props },
    ref
  ) => {
    const innerRef = useRef<HTMLSelectElement>(null)
    const [isPlaceholder, setIsPlaceholder] = useState(false)

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    )

    useEffect(() => {
      if (innerRef.current && innerRef.current.value === "") {
        setIsPlaceholder(true)
      } else {
        setIsPlaceholder(false)
      }
    }, [innerRef.current?.value])

    return (
      <div>
        <div
          onFocus={() => innerRef.current?.focus()}
          onBlur={() => innerRef.current?.blur()}
          className={cn(
            "relative flex items-center text-sm leading-6 font-normal",
            className,
            {
              "text-muted-foreground": isPlaceholder,
            }
          )}
        >
          <select
            ref={innerRef}
            defaultValue={defaultValue}
            {...props}
            // CORE-4g (กฎข้อ 63d): กรอบอยู่ที่ <select> และยืดเต็มความสูงของ wrapper — ผู้เรียกกำหนดความสูงผ่าน className
            // (เช่น CountrySelect ใช้ h-12 เท่า Input) แล้วกล่องของ element ที่มี data-testid สูงเท่ากัน
            className="appearance-none flex-1 self-stretch min-w-0 border border-input bg-muted rounded-md hover:bg-accent px-4 py-2.5 transition-colors duration-150 outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option disabled value="">
              {placeholder}
            </option>
            {children}
          </select>
          <span className="absolute right-4 inset-y-0 flex items-center pointer-events-none ">
            <ChevronsUpDown className="size-4" />
          </span>
        </div>
      </div>
    )
  }
)

NativeSelect.displayName = "NativeSelect"

export default NativeSelect
