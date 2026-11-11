import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventCouponRecord, CouponValidationResult } from '@/types'

const LOCAL_STORAGE_COUPONS_KEY = 'festflow_local_event_coupons'

export const DEFAULT_STARTER_COUPONS: EventCouponRecord[] = [
  {
    id: 'cpn_starter_fest20',
    club_id: 'club_demo',
    event_id: null,
    code: 'FEST20',
    discount_type: 'percentage',
    discount_value: 20,
    max_discount_amount: 150,
    min_purchase_amount: null,
    valid_from: null,
    valid_until: null,
    max_uses: null,
    used_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cpn_starter_campus50',
    club_id: 'club_demo',
    event_id: null,
    code: 'CAMPUS50',
    discount_type: 'fixed',
    discount_value: 50,
    max_discount_amount: null,
    min_purchase_amount: null,
    valid_from: null,
    valid_until: null,
    max_uses: null,
    used_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cpn_starter_tech20',
    club_id: 'club_demo',
    event_id: null,
    code: 'TECH20',
    discount_type: 'percentage',
    discount_value: 20,
    max_discount_amount: 100,
    min_purchase_amount: null,
    valid_from: null,
    valid_until: null,
    max_uses: null,
    used_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  },
]

let inMemoryCoupons: EventCouponRecord[] | null = null

function getLocalCoupons(): EventCouponRecord[] {
  if (inMemoryCoupons !== null) return inMemoryCoupons
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_COUPONS_KEY)
      if (raw) {
        inMemoryCoupons = JSON.parse(raw)
        return inMemoryCoupons!
      }
    }
  } catch {
    // fallback
  }
  inMemoryCoupons = [...DEFAULT_STARTER_COUPONS]
  return inMemoryCoupons
}

function saveLocalCoupons(coupons: EventCouponRecord[]): void {
  inMemoryCoupons = coupons
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_COUPONS_KEY, JSON.stringify(coupons))
    }
  } catch {
    // fallback
  }
}

/**
 * Fetch all coupons created by a club, optionally filtered by event
 */
export async function getClubCoupons(
  clubId: string,
  eventId?: string
): Promise<{ coupons: EventCouponRecord[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      let query = (supabase.from('event_coupons') as any)
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (eventId) {
        query = query.or(`event_id.eq.${eventId},event_id.is.null`)
      }

      const { data, error } = await query
      if (error) {
        return { coupons: [], error: error.message }
      }
      return { coupons: data || [] }
    } catch (err: any) {
      return {
        coupons: [],
        error: err?.message || 'Failed to load club coupons.',
      }
    }
  }

  const local = getLocalCoupons().filter(
    (c) => c.club_id === clubId && (!eventId || !c.event_id || c.event_id === eventId)
  )
  return { coupons: local }
}

/**
 * Create a new discount coupon
 */
export async function createCoupon(params: {
  club_id: string
  event_id?: string | null
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase_amount?: number
  max_discount_amount?: number | null
  max_uses?: number
  valid_from?: string
  valid_until?: string | null
  is_active?: boolean
}): Promise<{ coupon?: EventCouponRecord; error?: string }> {
  const normalizedCode = params.code.trim().toUpperCase()
  if (!normalizedCode) return { error: 'Coupon code cannot be empty.' }
  if (params.discount_value <= 0) return { error: 'Discount value must be greater than zero.' }
  if (params.discount_type === 'percentage' && params.discount_value > 100) {
    return { error: 'Percentage discount cannot exceed 100%.' }
  }

  const newRecord: EventCouponRecord = {
    id: `cpn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    club_id: params.club_id,
    event_id: params.event_id || null,
    code: normalizedCode,
    discount_type: params.discount_type,
    discount_value: params.discount_value,
    min_purchase_amount: params.min_purchase_amount || 0,
    max_discount_amount: params.max_discount_amount ?? null,
    max_uses: params.max_uses || 100,
    used_count: 0,
    valid_from: params.valid_from || new Date().toISOString(),
    valid_until: params.valid_until || null,
    is_active: params.is_active !== false,
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_coupons') as any)
        .insert({
          club_id: newRecord.club_id,
          event_id: newRecord.event_id,
          code: newRecord.code,
          discount_type: newRecord.discount_type,
          discount_value: newRecord.discount_value,
          min_purchase_amount: newRecord.min_purchase_amount,
          max_discount_amount: newRecord.max_discount_amount,
          max_uses: newRecord.max_uses,
          valid_from: newRecord.valid_from,
          valid_until: newRecord.valid_until,
          is_active: newRecord.is_active,
        })
        .select()
        .single()

      if (error) {
        return { error: error.message }
      }
      return { coupon: data }
    } catch (err: any) {
      return { error: err?.message || 'Failed to create coupon.' }
    }
  }

  const local = getLocalCoupons()
  local.unshift(newRecord)
  saveLocalCoupons(local)
  return { coupon: newRecord }
}

/**
 * Toggle coupon active status
 */
export async function toggleCouponActive(
  couponId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_coupons') as any)
        .update({ is_active: isActive })
        .eq('id', couponId)

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update coupon.' }
    }
  }

  const local = getLocalCoupons()
  const found = local.find((c) => c.id === couponId)
  if (found) {
    found.is_active = isActive
    saveLocalCoupons(local)
  }
  return { success: true }
}

/**
 * Delete a coupon
 */
export async function deleteCoupon(couponId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_coupons') as any)
        .delete()
        .eq('id', couponId)

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete coupon.' }
    }
  }

  const local = getLocalCoupons().filter((c) => c.id !== couponId)
  saveLocalCoupons(local)
  return { success: true }
}

/**
 * Server-side & frontend coupon validation engine
 */
export async function validateCoupon(
  code: string,
  eventId: string,
  ticketPrice: number
): Promise<CouponValidationResult> {
  const norm = code.trim().toUpperCase()
  if (!norm) return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'Please enter a coupon code.' }

  let coupon: EventCouponRecord | null = null

  if (isSupabaseConfigured) {
    try {
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('validate_event_coupon', {
        p_code: norm,
        p_event_id: eventId,
        p_ticket_price: ticketPrice,
      })

      if (!rpcErr && rpcRes) {
        if (!rpcRes.valid) {
          return {
            valid: false,
            discountAmount: 0,
            finalPrice: ticketPrice,
            error: rpcRes.error || 'Invalid or inactive coupon code.',
          }
        }
        return {
          valid: true,
          coupon: rpcRes.coupon as EventCouponRecord,
          discountAmount: Number(rpcRes.discountAmount ?? rpcRes.discount_amount ?? 0),
          finalPrice: Number(rpcRes.finalPrice ?? rpcRes.final_price ?? ticketPrice),
        }
      }

      if (rpcErr && rpcErr.code !== 'PGRST202' && !String(rpcErr.message || '').includes('does not exist')) {
        return {
          valid: false,
          discountAmount: 0,
          finalPrice: ticketPrice,
          error: rpcErr.message || 'Unable to validate coupon.',
        }
      }

      const { data, error } = await (supabase.from('event_coupons') as any)
        .select('*')
        .eq('code', norm)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        return {
          valid: false,
          discountAmount: 0,
          finalPrice: ticketPrice,
          error: error.message || 'Unable to validate coupon.',
        }
      }
      coupon = data || null
    } catch (err: any) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: ticketPrice,
        error: err?.message || 'Unable to validate coupon.',
      }
    }
  } else {
    const local = getLocalCoupons()
    coupon = local.find((c) => c.code === norm && c.is_active) || null
  }

  if (!coupon) {
    return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'Invalid or inactive coupon code.' }
  }

  // Check event restriction
  if (coupon.event_id && coupon.event_id !== eventId) {
    return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'This coupon is not valid for this specific event.' }
  }

  // Check validity dates
  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'This coupon code is not active yet.' }
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'This coupon code has expired.' }
  }

  // Check usage limit
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return { valid: false, discountAmount: 0, finalPrice: ticketPrice, error: 'This coupon has reached its maximum redemption limit.' }
  }

  // Check minimum purchase amount
  if (coupon.min_purchase_amount && ticketPrice < coupon.min_purchase_amount) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: ticketPrice,
      error: `Minimum pass price of ₹${coupon.min_purchase_amount} required to use this coupon.`,
    }
  }

  // Calculate discount
  let discount = 0
  if (coupon.discount_type === 'percentage') {
    discount = Math.round((ticketPrice * coupon.discount_value) / 100)
    if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
      discount = coupon.max_discount_amount
    }
  } else {
    discount = coupon.discount_value
  }

  // Cannot discount more than original price
  discount = Math.min(discount, ticketPrice)
  const finalPrice = Math.max(0, ticketPrice - discount)

  return {
    valid: true,
    coupon,
    discountAmount: discount,
    finalPrice,
  }
}

/**
 * Increment usage counter after successful order
 */
export async function redeemCoupon(couponId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await (supabase.rpc as any)('increment_coupon_usage', { p_coupon_id: couponId })
    } catch {
      // ignore RPC errors on non-critical increment wrapper
    }
    return
  }

  const local = getLocalCoupons()
  const found = local.find((c) => c.id === couponId)
  if (found) {
    found.used_count = (found.used_count || 0) + 1
    saveLocalCoupons(local)
  }
}

