"use server"

import { sdk } from "@lib/config"
import { errorMessage, friendlyErrorMessage } from "@lib/util/error-message"
import { HttpTypes } from "@medusajs/types"
import { FetchError } from "@medusajs/js-sdk"
import { revalidateTag } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  getPendingCustomer,
  removeAuthToken,
  removeCartId,
  removePendingCustomer,
  setAuthToken,
  setPendingCustomer,
} from "./cookies"
import { addToCart } from "./cart"
import {
  loginPathForAddToCart,
  readPendingAddToCart,
} from "@lib/util/pending-add-to-cart"
import { readReturnTo } from "@lib/util/login-return"
import { buyFromPermalink } from "@lib/util/server-cart"

export type CustomerAuthState =
  // CORE-4f (กฎข้อ 62): `email` = อีเมลที่กรอกไว้ ฟอร์ม login/register ใช้เป็น defaultValue ไม่ให้หายเมื่อล้ม
  | { state: "error"; error: string; email?: string }
  | { state: "verification_required"; email: string }
  | { state: "success" }
  | null

// Requests a verification email for the given customer. The request must be
// authenticated with a token tied to the auth identity (the token returned by
// register or by a login that requires verification).
async function requestVerificationEmail(email: string, token: string) {
  await sdk.auth.verification.request(
    {
      entity_id: email,
      entity_type: "email",
    },
    {
      authorization: `Bearer ${token}`,
    }
  )
}

// CORE-4f (กฎข้อ 62): ข้อความ error ของหน้า login/register เป็นไทยเสมอ ไม่ส่งข้อความอังกฤษของ auth provider
const INVALID_CREDENTIALS_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
const LOGIN_FAILED_MESSAGE = "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
const SIGNUP_FAILED_MESSAGE = "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
const EMAIL_TAKEN_MESSAGE = "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น"

const withEmail = (result: CustomerAuthState, email: string): CustomerAuthState =>
  result?.state === "error" ? { ...result, email } : result

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!("authorization" in authHeaders)) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

// CORE-23 (spec 01 กฎข้อ 52): server action ที่ throw ข้าม boundary กลายเป็น "Minified React error #441" ใน prod
// (ข้อความจริงถูกตัดทิ้ง) → คืนผลเป็นข้อความไทยแทนการ throw; 401/403 (token หมดอายุ/ถูกลบ) → friendlyErrorMessage ให้เข้าสู่ระบบใหม่
export const updateCustomer = async (
  body: HttpTypes.StoreUpdateCustomer
): Promise<{ success: boolean; error: string | null }> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    await sdk.store.customer.update(body, {}, headers)
  } catch (error) {
    return {
      success: false,
      error: friendlyErrorMessage(error, "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
    }
  }

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag, { expire: 0 })

  return { success: true, error: null }
}

export async function signup(
  _currentState: unknown,
  formData: FormData
): Promise<CustomerAuthState> {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  let identityExists = false
  try {
    await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password,
    })
  } catch (error) {
    const fetchError = error as FetchError
    // An existing identity (for example, an admin user with the same email) is
    // expected and handled: the customer can still log in to link a customer
    // record. Any other error is surfaced.
    if (
      fetchError.statusText !== "Unauthorized" ||
      fetchError.message !== "Identity with email already exists"
    ) {
      return {
        state: "error",
        error: friendlyErrorMessage(error, SIGNUP_FAILED_MESSAGE),
        email: customerForm.email,
      }
    }
    identityExists = true
  }

  // Persist the extra signup fields. The customer record is created during
  // login, which is deferred until after email verification when the backend
  // requires it.
  await setPendingCustomer(customerForm)

  // Continue by logging in. The login response tells us whether the backend
  // requires email verification — we don't need a storefront-side flag.
  const result = await completeLogin(customerForm.email, password)
  // อีเมลมีบัญชีอยู่แล้วและรหัสผ่านไม่ตรง → บอกว่าอีเมลถูกใช้แล้ว แทน "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
  if (
    identityExists &&
    result?.state === "error" &&
    result.error === INVALID_CREDENTIALS_MESSAGE
  ) {
    return { state: "error", error: EMAIL_TAKEN_MESSAGE, email: customerForm.email }
  }

  return withEmail(await continueAfterAuth(formData, result), customerForm.email)
}

export async function login(
  _currentState: unknown,
  formData: FormData
): Promise<CustomerAuthState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  return withEmail(
    await continueAfterAuth(formData, await completeLogin(email, password)),
    email
  )
}

// CORE-6 (spec 01 AC-6): guest ที่กด "Add to cart" ถูกส่งมาล็อกอินพร้อม variant ที่ค้างไว้
// ล็อกอินสำเร็จ → เพิ่มลง cart แล้วไปหน้า cart
// CORE-14 (AC-41): มาจาก /buy/... → ล็อกอินสำเร็จแล้วสร้าง cart จากลิงก์เดิมแล้วไป checkout
// (ไม่ redirect ไป route handler `/buy` จาก server action เพราะ client router ตาม redirect แบบ RSC ไม่ได้)
async function continueAfterAuth(
  formData: FormData,
  result: CustomerAuthState
): Promise<CustomerAuthState> {
  const returnTo = readReturnTo(formData)
  if (result?.state === "success" && returnTo) {
    const url = new URL(returnTo, "http://storefront.invalid")
    const bought = await buyFromPermalink(
      url.pathname.slice("/buy/".length),
      url.searchParams.get("context/address_country")
    )
    if ("error" in bought || bought.next === "login") {
      return { state: "error", error: "error" in bought ? bought.error : "กรุณาเข้าสู่ระบบอีกครั้ง" }
    }
    redirect(`/${bought.countryCode}/checkout`)
  }

  const pending = readPendingAddToCart(formData)
  if (result?.state !== "success" || !pending) {
    return result
  }

  return addPendingToCart(pending)
}

// CORE-14d (กฎ 58, owner 2026-10-27): ลูกค้าที่ล็อกอินอยู่แล้วเปิดลิงก์ `/account?add_variant=…` ไม่ถูกเพิ่มลง cart เอง
// (กด Back หลัง login แล้วเพิ่มซ้ำ / ลิงก์จากเว็บอื่น) — ต้องกดปุ่มยืนยัน (ฟอร์ม POST ใช้ได้แม้ปิด JS) ซึ่งเรียก action นี้
// readPendingAddToCart ตรวจรหัสประเทศ (กัน redirect ออกนอกร้าน) และ clamp quantity 1..100 ให้แล้ว
export async function confirmPendingAdd(formData: FormData): Promise<void> {
  const pending = readPendingAddToCart(formData)
  if (!pending) {
    throw new Error("ข้อมูลสินค้าที่จะเพิ่มลงตะกร้าไม่ถูกต้อง")
  }
  await addPendingToCart(pending)
}

// CORE-14b (กฎ 26) / CORE-14d (กฎ 57): เพิ่ม variant ที่ค้างไว้ลง cart แล้วไปหน้า cart (หลัง login หรือกดปุ่มยืนยัน)
// เพิ่มไม่สำเร็จ (variant ไม่มีอยู่/ขายไม่ได้/ถูกลบระหว่างทาง) → หน้าบัญชีพร้อม add_error ให้แสดง `add-variant-error`
// (คืน state error ตรงนี้จะหายไปเมื่อ layout สลับเป็น dashboard); redirect/notFound ส่งต่อด้วย unstable_rethrow
// ไม่ export — ผู้เรียกส่ง pending ที่ผ่าน readPendingAddToCart แล้วเท่านั้น
async function addPendingToCart(
  pending: NonNullable<ReturnType<typeof readPendingAddToCart>>
): Promise<never> {
  let added = true
  try {
    await addToCart(pending)
  } catch (error) {
    unstable_rethrow(error)
    console.error(error)
    added = false
  }

  redirect(
    added
      ? `/${pending.countryCode}/cart`
      : loginPathForAddToCart(pending.countryCode, pending.variantId, pending.quantity, {
          failed: true,
        })
  )
}

// Logs the customer in and reconciles the customer record. The behavior is
// driven entirely by the backend's login response, so it works whether or not
// email verification is enabled.
async function completeLogin(
  email: string,
  password: string
): Promise<CustomerAuthState> {
  let result: Awaited<ReturnType<typeof sdk.auth.login>>

  try {
    result = await sdk.auth.login("customer", "emailpass", { email, password })
  } catch (error) {
    // CORE-4e: 401 ของ emailpass = "Invalid email or password" (อังกฤษ) → ข้อความไทย
    const status = (error as { status?: unknown } | null)?.status
    return {
      state: "error",
      error:
        status === 401
          ? INVALID_CREDENTIALS_MESSAGE
          : friendlyErrorMessage(error, LOGIN_FAILED_MESSAGE),
    }
  }

  // A `location` is returned by third-party auth providers, which this flow
  // doesn't support.
  if (typeof result === "object" && "location" in result) {
    return {
      state: "error",
      error: "ร้านไม่รองรับวิธีเข้าสู่ระบบนี้",
    }
  }

  // The backend requires email verification and the customer hasn't verified
  // yet. Send the verification email and ask them to check their inbox.
  if (
    typeof result === "object" &&
    "verification_required" in result &&
    result.verification_required
  ) {
    try {
      await requestVerificationEmail(email, result.token)
    } catch (error) {
      // The customer can resend from the verification page.
      console.error(error)
    }
    return { state: "verification_required", email }
  }

  if (typeof result !== "string") {
    return {
      state: "error",
      error: "การยืนยันตัวตนต้องใช้ขั้นตอนเพิ่มเติมที่ร้านยังไม่รองรับ",
    }
  }

  let token = result

  // The token may not be tied to a customer record yet — right after
  // registration, or after verifying a brand-new account. Ask the backend:
  // `/store/customers/me` rejects tokens without a registered actor, so a
  // failed retrieve means we still need to create the customer, then log in
  // again to obtain a customer-bound token.
  const customerExists = await sdk.store.customer
    .retrieve({}, { authorization: `Bearer ${token}` })
    .then(() => true)
    .catch(() => false)

  if (!customerExists) {
    const pending = await getPendingCustomer()

    try {
      await sdk.store.customer.create(
        {
          email,
          first_name: pending?.first_name,
          last_name: pending?.last_name,
          phone: pending?.phone,
        },
        {},
        { authorization: `Bearer ${token}` }
      )

      token = (await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      })) as string
    } catch (error) {
      return { state: "error", error: friendlyErrorMessage(error, LOGIN_FAILED_MESSAGE) }
    }

    await removePendingCustomer()
  }

  await setAuthToken(token)

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag, { expire: 0 })

  try {
    await transferCart()
  } catch (error) {
    return { state: "error", error: friendlyErrorMessage(error, LOGIN_FAILED_MESSAGE) }
  }

  return { state: "success" }
}

// Confirms a customer's email using the token from the verification link.
//
// The confirm route doesn't require authentication, so this works even when the
// customer opens the link on a different device than the one they signed up on.
export async function confirmEmailVerification(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await sdk.auth.verification.confirm({ code: token })
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag, { expire: 0 })

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  // CORE-14c (spec 01 กฎข้อ 40): cookie ชี้ cart ของ customer อื่น → ownership ของ CORE-12 (ADR-013) ตอบ 404
  // → ทิ้ง cookie นั้นแทนการให้ login ล้ม; error อื่น (5xx/network) ส่งต่อตามเดิม
  try {
    await sdk.store.cart.transferCart(cartId, {}, headers)
  } catch (error) {
    if (!(error instanceof FetchError) || error.status !== 404) {
      throw error
    }
    await removeCartId()
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag, { expire: 0 })
      return { success: true, error: null }
    })
    .catch((err) => {
      console.error(err)
      return { success: false, error: friendlyErrorMessage(err) }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag, { expire: 0 })
      return { success: true, error: null }
    })
    .catch((err) => {
      console.error(err)
      return { success: false, error: friendlyErrorMessage(err) }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "ไม่พบที่อยู่ที่ต้องการแก้ไข" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag, { expire: 0 })
      return { success: true, error: null }
    })
    .catch((err) => {
      console.error(err)
      return { success: false, error: friendlyErrorMessage(err) }
    })
}
