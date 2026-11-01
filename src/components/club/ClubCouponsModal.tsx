import { useState, useEffect } from 'react'
import {
  Tag,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button, Badge } from '@/components/ui'
import {
  getClubCoupons,
  createCoupon,
  toggleCouponActive,
  deleteCoupon,
} from '@/lib/coupons'
import type { EventCouponRecord } from '@/types'

interface ClubCouponsModalProps {
  isOpen: boolean
  onClose: () => void
  clubId: string
  eventId?: string
  eventTitle?: string
}

export function ClubCouponsModal({
  isOpen,
  onClose,
  clubId,
  eventId,
  eventTitle,
}: ClubCouponsModalProps) {
  const [coupons, setCoupons] = useState<EventCouponRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Form State
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('20')
  const [minPurchase, setMinPurchase] = useState('0')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [maxUses, setMaxUses] = useState('50')
  const [validUntil, setValidUntil] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCoupons = async () => {
    if (!clubId) return
    setLoading(true)
    const res = await getClubCoupons(clubId, eventId)
    setLoading(false)
    if (res.coupons) setCoupons(res.coupons)
  }

  useEffect(() => {
    if (isOpen) {
      loadCoupons()
      setShowAddForm(false)
      setNotice(null)
    }
  }, [isOpen, clubId, eventId])

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setNotice(null)

    const val = parseFloat(discountValue)
    if (isNaN(val) || val <= 0) {
      setNotice({ message: 'Discount value must be greater than zero.', isError: true })
      setSubmitting(false)
      return
    }

    const res = await createCoupon({
      club_id: clubId,
      event_id: eventId || null,
      code,
      discount_type: discountType,
      discount_value: val,
      min_purchase_amount: parseFloat(minPurchase) || 0,
      max_discount_amount: maxDiscount ? parseFloat(maxDiscount) : null,
      max_uses: parseInt(maxUses, 10) || 100,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
    })

    setSubmitting(false)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
      return
    }

    setNotice({ message: `Coupon "${code.toUpperCase()}" created successfully!` })
    setCode('')
    setShowAddForm(false)
    loadCoupons()
  }

  const handleToggle = async (couponId: string, current: boolean) => {
    await toggleCouponActive(couponId, !current)
    setCoupons((prev) =>
      prev.map((c) => (c.id === couponId ? { ...c, is_active: !current } : c))
    )
  }

  const handleDelete = async (couponId: string) => {
    await deleteCoupon(couponId)
    setCoupons((prev) => prev.filter((c) => c.id !== couponId))
  }

  const handleCopy = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode)
    setCopiedCode(couponCode)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discount Coupons & Promo Codes">
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">
                Create promotional discount codes for {eventTitle ? `"${eventTitle}"` : 'all your club events'}.
              </p>
            </div>
            {!showAddForm && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => setShowAddForm(true)}
              >
                New Coupon
              </Button>
            )}
          </div>

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                notice.isError
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              <AlertCircle size={14} />
              <span>{notice.message}</span>
            </div>
          )}

          {/* Form to Create New Coupon */}
          {showAddForm && (
            <form
              onSubmit={handleCreateCoupon}
              className="p-4 rounded-2xl bg-[#0E0E12] border border-[#18CFFC]/30 flex flex-col gap-3 shadow-xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Tag size={13} className="text-[#18CFFC]" />
                  Create Promo Code
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="e.g. FESTPASS20"
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs font-mono font-bold text-white placeholder-zinc-500 uppercase focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    <option value="percentage">Percentage Off (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Value * ({discountType === 'percentage' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={discountType === 'percentage' ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Min Purchase (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    placeholder="Optional cap for % off"
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Save Coupon'}
                </Button>
              </div>
            </form>
          )}

          {/* Coupons List */}
          <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400">Loading coupons...</div>
            ) : coupons.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No discount coupons created yet. Click "New Coupon" above to offer promotional ticket discounts.
              </div>
            ) : (
              coupons.map((coupon) => {
                const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date()
                const isLimitReached = coupon.max_uses && coupon.used_count >= coupon.max_uses

                return (
                  <div
                    key={coupon.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      !coupon.is_active || isExpired || isLimitReached
                        ? 'bg-white/[0.02] border-white/5 opacity-70'
                        : 'bg-[#14141A] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#18CFFC]/10 text-[#18CFFC] flex items-center justify-center font-mono font-bold text-xs">
                        {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white tracking-wider">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(coupon.code)}
                            className="text-zinc-500 hover:text-white cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === coupon.code ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                          <span>
                            Used: <strong className="text-white">{coupon.used_count}</strong> / {coupon.max_uses}
                          </span>
                          {coupon.valid_until && (
                            <span>
                              Expires: {new Date(coupon.valid_until).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isExpired ? (
                        <Badge variant="danger" className="text-[10px]">Expired</Badge>
                      ) : isLimitReached ? (
                        <Badge variant="amber" className="text-[10px]">Depleted</Badge>
                      ) : coupon.is_active ? (
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px]">Inactive</Badge>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggle(coupon.id, coupon.is_active)}
                        className="text-zinc-400 hover:text-white cursor-pointer p-1"
                        title={coupon.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {coupon.is_active ? (
                          <ToggleRight size={20} className="text-[#18CFFC]" />
                        ) : (
                          <ToggleLeft size={20} className="text-zinc-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(coupon.id)}
                        className="text-zinc-500 hover:text-rose-400 cursor-pointer p-1"
                        title="Delete Coupon"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  )
}

