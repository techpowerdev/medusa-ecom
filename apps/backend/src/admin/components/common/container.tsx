import { Container as UiContainer, clx } from "@medusajs/ui"

// spec 08 (ADM-2a): Container ตาม Custom Component Guides ของ Medusa
// https://docs.medusajs.com/resources/admin-components/guides/container — dashboard ไม่ export
type ContainerProps = React.ComponentProps<typeof UiContainer>

export const Container = (props: ContainerProps) => {
  return <UiContainer {...props} className={clx("divide-y p-0", props.className)} />
}
