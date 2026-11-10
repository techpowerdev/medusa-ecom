import { ActionMenu, type ActionMenuProps } from "@medusajs/dashboard/components"
import { Button, Heading, Text } from "@medusajs/ui"
import { Fragment } from "react"
import { Link, type LinkProps } from "react-router-dom"

// spec 08 (ADM-2a): Header ตาม Custom Component Guides ของ Medusa
// https://docs.medusajs.com/resources/admin-components/guides/header — dashboard ไม่ export header
// ต่างจาก guide: ActionMenu มาจาก @medusajs/dashboard/components (export แล้ว), ปุ่มที่มี link ใช้ Button asChild
// (guide ใส่ <Link> ว่างไว้ในปุ่ม) และ props ของปุ่มรับ data-testid ส่งต่อถึงปุ่ม (e2e หาด้วย testid)
type ButtonProps = React.ComponentProps<typeof Button> & { "data-testid"?: string }

export type HeadingProps = {
  title: string
  subtitle?: string
  actions?: (
    | { type: "button"; props: ButtonProps; link?: LinkProps }
    | { type: "action-menu"; props: ActionMenuProps }
    | { type: "custom"; children: React.ReactNode }
  )[]
}

export const Header = ({ title, subtitle, actions = [] }: HeadingProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <Heading level="h2">{title}</Heading>
        {subtitle && (
          <Text className="text-ui-fg-subtle" size="small">
            {subtitle}
          </Text>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex items-center justify-center gap-x-2">
          {actions.map((action, index) => (
            <Fragment key={index}>
              {action.type === "button" &&
                (action.link ? (
                  <Button {...action.props} size={action.props.size || "small"} asChild>
                    <Link {...action.link}>{action.props.children}</Link>
                  </Button>
                ) : (
                  <Button {...action.props} size={action.props.size || "small"} />
                ))}
              {action.type === "action-menu" && <ActionMenu {...action.props} />}
              {action.type === "custom" && action.children}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
