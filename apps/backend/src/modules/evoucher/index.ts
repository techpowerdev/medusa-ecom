import { Module } from "@medusajs/framework/utils"
import EvoucherModuleService from "./service"

export const EVOUCHER_MODULE = "evoucher"

export default Module(EVOUCHER_MODULE, {
  service: EvoucherModuleService,
})
