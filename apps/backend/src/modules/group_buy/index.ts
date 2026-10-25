import { Module } from "@medusajs/framework/utils"
import GroupBuyModuleService from "./service"

export const GROUP_BUY_MODULE = "group_buy"

export default Module(GROUP_BUY_MODULE, {
  service: GroupBuyModuleService,
})
